param([switch]$SelfTest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing,System.Web.Extensions
$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
public static class NyxDesktop {
 [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public IntPtr dwExtraInfo; }
 [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk,wScan; public uint dwFlags,time; public IntPtr dwExtraInfo; }
 [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mouse; [FieldOffset(0)] public KEYBDINPUT keyboard; }
 [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
 [DllImport("user32.dll",SetLastError=true)] static extern uint SendInput(uint count,INPUT[] inputs,int size);
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll",SetLastError=true)] static extern IntPtr OpenInputDesktop(uint flags,bool inherit,uint access);
 [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr desktop);
 static readonly object gate=new object();
 static readonly HashSet<int> keys=new HashSet<int>();
 static readonly HashSet<int> buttons=new HashSet<int>();
 static bool active=false;
 static volatile bool stopped=false;
 static NotifyIcon tray;
 static void Emit(string line){ lock(Console.Out){ Console.WriteLine(line); Console.Out.Flush(); } }
 static void Input(INPUT value){SendInput(1,new INPUT[]{value},Marshal.SizeOf(typeof(INPUT)));}
 static bool Extended(int key){return (key>=33&&key<=40)||key==45||key==46||key==91||key==92||key==111||key==163||key==165;}
 static void Key(int key,bool down){var value=new INPUT{type=1};value.data.keyboard.wVk=(ushort)key;value.data.keyboard.dwFlags=(down?0u:2u)|(Extended(key)?1u:0u);Input(value);if(down)keys.Add(key);else keys.Remove(key);}
 static void Button(int button,bool down){var value=new INPUT{type=0};value.data.mouse.dwFlags=button==0?(down?2u:4u):button==2?(down?8u:16u):(down?32u:64u);Input(value);if(down)buttons.Add(button);else buttons.Remove(button);}
 static void Release(){foreach(int key in new List<int>(keys))Key(key,false);foreach(int button in new List<int>(buttons))Button(button,false);}
 static void Command(string line){
  var data=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(line);string type=Convert.ToString(data["type"]);
  lock(gate){
   if(type=="control"){active=Convert.ToBoolean(data["active"]);Release();return;}
   if(type=="release"){Release();return;}
   if(!active)return;
   if(type=="key"){int key=Convert.ToInt32(data["key"]);string action=Convert.ToString(data["action"]);if(key>=8&&key<=222&&(action=="down"||action=="up"))Key(key,action=="down");}
   if(type=="pointer"){
    double x=Convert.ToDouble(data["x"]),y=Convert.ToDouble(data["y"]);int button=Convert.ToInt32(data["button"]);string action=Convert.ToString(data["action"]);
    if(Double.IsNaN(x)||Double.IsNaN(y)||x<0||x>1||y<0||y>1||button<0||button>2)return;
    var bounds=Screen.PrimaryScreen.Bounds;var desktop=SystemInformation.VirtualScreen;
    var move=new INPUT{type=0};move.data.mouse.dx=(int)((bounds.Left+x*(bounds.Width-1)-desktop.Left)*65535/Math.Max(1,desktop.Width-1));move.data.mouse.dy=(int)((bounds.Top+y*(bounds.Height-1)-desktop.Top)*65535/Math.Max(1,desktop.Height-1));move.data.mouse.dwFlags=0xC001;Input(move);
    if(action=="down"||action=="up")Button(button,action=="down");
   }
   if(type=="wheel"){int delta=Math.Max(-3,Math.Min(3,Convert.ToInt32(data["delta"])));var value=new INPUT{type=0};value.data.mouse.mouseData=unchecked((uint)(-delta*120));value.data.mouse.dwFlags=0x800;Input(value);}
  }
 }
 public static void SelfTest(){SetProcessDPIAware();Emit("READY:"+Marshal.SizeOf(typeof(INPUT)));}
 public static void Run(){
  SetProcessDPIAware();
  tray=new NotifyIcon{Icon=SystemIcons.Application,Visible=true,Text="Nyx Remote: waiting for your connection"};
  var menu=new ContextMenuStrip();
  menu.Items.Add("Disconnect viewer",null,(sender,args)=>{lock(gate){active=false;Release();}Emit("STOP");});
  menu.Items.Add("Exit Nyx Remote",null,(sender,args)=>{stopped=true;lock(gate){active=false;Release();}tray.Visible=false;Application.Exit();});tray.ContextMenuStrip=menu;
  var reader=new Thread(()=>{try{string line;while(!stopped&&(line=Console.ReadLine())!=null){if(line.Length<2048)try{Command(line);}catch{}}}finally{lock(gate){active=false;Release();}stopped=true;}});reader.IsBackground=true;reader.Start();
  var encoder=Array.Find(ImageCodecInfo.GetImageEncoders(),item=>item.MimeType=="image/jpeg");
  var options=new EncoderParameters(1);options.Param[0]=new EncoderParameter(System.Drawing.Imaging.Encoder.Quality,55L);
  var timer=new System.Windows.Forms.Timer{Interval=250};
  timer.Tick+=(sender,args)=>{
   if(stopped){Application.Exit();return;}
   bool capture;lock(gate){capture=active;}
   tray.Text=capture?"Nyx Remote: OWNER CONNECTED":"Nyx Remote: waiting for your connection";
   if(!capture)return;
   try{
    IntPtr desktop=OpenInputDesktop(0,false,0x100);if(desktop==IntPtr.Zero){Emit("STATUS:Windows is locked or showing a secure desktop.");return;}CloseDesktop(desktop);
    var bounds=Screen.PrimaryScreen.Bounds;int width=Math.Min(1600,bounds.Width),height=Math.Max(1,bounds.Height*width/bounds.Width);
    using(var raw=new Bitmap(bounds.Width,bounds.Height))using(var graphics=Graphics.FromImage(raw)){
     graphics.CopyFromScreen(bounds.Location,Point.Empty,bounds.Size);
     using(var resized=new Bitmap(width,height))using(var scaled=Graphics.FromImage(resized))using(var output=new MemoryStream()){
      scaled.DrawImage(raw,0,0,width,height);resized.Save(output,encoder,options);Emit("FRAME:"+Convert.ToBase64String(output.ToArray()));
     }
    }
   }catch{Emit("STATUS:Desktop unavailable. Unlock Windows locally to continue.");}
  };
  timer.Start();Emit("READY");Application.Run();timer.Dispose();options.Dispose();lock(gate){active=false;Release();}tray.Dispose();
 }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms,System.Drawing,System.Web.Extensions
if ($SelfTest) { [NyxDesktop]::SelfTest() } else { [NyxDesktop]::Run() }
