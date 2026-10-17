export function q83c71(event,backend){
  var request=event.request,headers=request.headers,origin=headers.origin&&headers.origin.value;
  if((origin&&origin!=='https://'+headers.host.value)||(headers['sec-fetch-site']&&headers['sec-fetch-site'].value==='cross-site'))return {statusCode:403,statusDescription:'Forbidden',headers:{'cache-control':{value:'no-store'}}};
  if(origin)headers.origin={value:'https://'+backend};
  headers['x-forwarded-host']={value:backend};
  return request;
}
export function q64a29(event){
  var request=event.request;
  if(request.uri.endsWith('/'))request.uri+='index.html';
  return request;
}
export function awsTemplate(){
  const ref=name=>({Ref:name}),att=(name,key)=>({'Fn::GetAtt':[name,key]}),sub=value=>({'Fn::Sub':value});
  const association=name=>[{EventType:'viewer-request',FunctionARN:att(name,'FunctionMetadata.FunctionARN')}];
  const backend={TargetOriginId:'service',ViewerProtocolPolicy:'redirect-to-https',AllowedMethods:['GET','HEAD','OPTIONS','PUT','PATCH','POST','DELETE'],CachedMethods:['GET','HEAD'],Compress:false,CachePolicyId:ref('Uncached'),OriginRequestPolicyId:ref('ForwardService'),FunctionAssociations:association('ServiceBoundary')};
  return {
    AWSTemplateFormatVersion:'2010-09-09',Description:'Nyx static S3 frontend with same-origin backend routing. Existing bucket contents and policy are preserved by upload.mjs.',
    Parameters:{Bucket:{Type:'String',AllowedPattern:'[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]'},BucketRegion:{Type:'String'},Prefix:{Type:'String',Default:'nyx',AllowedPattern:'[A-Za-z0-9_-]+'},BackendHost:{Type:'String',Default:'vps-a556737a.vps.ovh.us',AllowedPattern:'[a-zA-Z0-9.-]+'}},
    Resources:{
      Access:{Type:'AWS::CloudFront::OriginAccessControl',Properties:{OriginAccessControlConfig:{Name:sub('${AWS::StackName}-files'),OriginAccessControlOriginType:'s3',SigningBehavior:'always',SigningProtocol:'sigv4'}}},
      Uncached:{Type:'AWS::CloudFront::CachePolicy',Properties:{CachePolicyConfig:{Name:sub('${AWS::StackName}-uncached'),MinTTL:0,DefaultTTL:0,MaxTTL:0,ParametersInCacheKeyAndForwardedToOrigin:{EnableAcceptEncodingGzip:false,EnableAcceptEncodingBrotli:false,HeadersConfig:{HeaderBehavior:'none'},CookiesConfig:{CookieBehavior:'none'},QueryStringsConfig:{QueryStringBehavior:'none'}}}}},
      ForwardService:{Type:'AWS::CloudFront::OriginRequestPolicy',Properties:{OriginRequestPolicyConfig:{Name:sub('${AWS::StackName}-service'),CookiesConfig:{CookieBehavior:'all'},QueryStringsConfig:{QueryStringBehavior:'all'},HeadersConfig:{HeaderBehavior:'allExcept',Headers:['host']}}}},
      ServiceBoundary:{Type:'AWS::CloudFront::Function',Properties:{Name:sub('${AWS::StackName}-service'),AutoPublish:true,FunctionConfig:{Comment:'Validate viewer origin before forwarding to the Nyx service',Runtime:'cloudfront-js-2.0'},FunctionCode:sub(q83c71.toString()+'\nfunction handler(event){return q83c71(event,"${BackendHost}");}')}},
      FileIndex:{Type:'AWS::CloudFront::Function',Properties:{Name:sub('${AWS::StackName}-index'),AutoPublish:true,FunctionConfig:{Comment:'Resolve directory entry documents in S3',Runtime:'cloudfront-js-2.0'},FunctionCode:q64a29.toString()+'\nfunction handler(event){return q64a29(event);}'}},
      Distribution:{Type:'AWS::CloudFront::Distribution',Properties:{DistributionConfig:{Enabled:true,Comment:'Nyx connected static frontend',HttpVersion:'http2',IPV6Enabled:true,DefaultRootObject:'index.html',PriceClass:'PriceClass_100',ViewerCertificate:{CloudFrontDefaultCertificate:true},Origins:[{Id:'files',DomainName:sub('${Bucket}.s3.${BucketRegion}.amazonaws.com'),OriginPath:sub('/${Prefix}'),OriginAccessControlId:ref('Access'),S3OriginConfig:{OriginAccessIdentity:''}},{Id:'service',DomainName:ref('BackendHost'),CustomOriginConfig:{OriginProtocolPolicy:'https-only',OriginSSLProtocols:['TLSv1.2'],OriginReadTimeout:60}}],DefaultCacheBehavior:{TargetOriginId:'files',ViewerProtocolPolicy:'redirect-to-https',AllowedMethods:['GET','HEAD','OPTIONS'],CachedMethods:['GET','HEAD'],Compress:true,CachePolicyId:ref('Uncached'),FunctionAssociations:association('FileIndex')},CacheBehaviors:['api/*','socket.io*','resources/live*','wisp*','healthz','gn-math-*','download/*'].map(PathPattern=>({PathPattern,...backend}))}}}
    },
    Outputs:{Url:{Value:sub('https://${Distribution.DomainName}/')},DistributionId:{Value:ref('Distribution')},BucketPrefix:{Value:sub('s3://${Bucket}/${Prefix}/')}}
  };
}
