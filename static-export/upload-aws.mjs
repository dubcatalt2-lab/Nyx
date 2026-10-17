import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const [bucket,prefix='nyx',stack='nyx-static']=process.argv.slice(2);
if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket||'')||!/^[A-Za-z0-9_-]+$/.test(prefix)||!/^[a-zA-Z][a-zA-Z0-9-]{0,39}$/.test(stack))throw Error('Usage: node upload.mjs BUCKET [folder-name] [stack-name]');
const aws=(args,options={})=>{const result=spawnSync(process.platform==='win32'?'aws.exe':'aws',args,{encoding:'utf8',maxBuffer:8_000_000});if(result.error)throw result.error;if(result.status!==0){if(options.allowFailure)return result;throw Error(result.stderr||result.stdout||'AWS command failed');}return options.raw?result.stdout:JSON.parse(result.stdout||'null');};
const regionResult=aws(['s3api','get-bucket-location','--bucket',bucket,'--output','json']);
const region=regionResult.LocationConstraint==='EU'?'eu-west-1':regionResult.LocationConstraint||'us-east-1';
console.log('Uploading static files and creating/updating AWS hosting. AWS usage charges apply. Existing bucket objects outside the selected folder are unchanged.');
aws(['s3','sync',join(root,'site'),`s3://${bucket}/${prefix}/`,'--region',region,'--cache-control','no-cache','--only-show-errors'],{raw:true});
aws(['cloudformation','deploy','--region',region,'--stack-name',stack,'--template-file',join(root,'hosting.json'),'--parameter-overrides',`Bucket=${bucket}`,`BucketRegion=${region}`,`Prefix=${prefix}`,'--no-fail-on-empty-changeset'],{raw:true});
const outputs=aws(['cloudformation','describe-stacks','--region',region,'--stack-name',stack,'--output','json']).Stacks[0].Outputs;
const output=key=>outputs.find(item=>item.OutputKey===key).OutputValue;
const distribution=output('DistributionId'),account=aws(['sts','get-caller-identity','--output','json']).Account;
const policyResult=aws(['s3api','get-bucket-policy','--bucket',bucket,'--output','json'],{allowFailure:true});
let policy;
if(policyResult?.status!==undefined){if(!policyResult.stderr.includes('NoSuchBucketPolicy'))throw Error(policyResult.stderr);policy={Version:'2012-10-17',Statement:[]};}
else policy=JSON.parse(policyResult.Policy);
const sid='NyxCloudFront'+distribution;
policy.Statement=[...(Array.isArray(policy.Statement)?policy.Statement:[policy.Statement]).filter(Boolean).filter(item=>item.Sid!==sid),{Sid:sid,Effect:'Allow',Principal:{Service:'cloudfront.amazonaws.com'},Action:'s3:GetObject',Resource:`arn:aws:s3:::${bucket}/${prefix}/*`,Condition:{StringEquals:{'AWS:SourceArn':`arn:aws:cloudfront::${account}:distribution/${distribution}`}}}];
const policyFile=join(root,'.bucket-policy.json');
try{writeFileSync(policyFile,JSON.stringify(policy));aws(['s3api','put-bucket-policy','--bucket',bucket,'--policy','file://'+policyFile],{raw:true});}finally{try{unlinkSync(policyFile);}catch{}}
aws(['cloudfront','create-invalidation','--distribution-id',distribution,'--paths','/*'],{raw:true});
console.log('Nyx URL: '+output('Url'));
console.log('Use that HTTPS CloudFront URL. Direct S3 object links cannot route backend requests.');
