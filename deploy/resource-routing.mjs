import {resourcePaths,resourceAliasPattern,resourceExcludedPrefixes} from '../lib/resource-routing.mjs';
export function enableResourceRouting(source){
 const start=source.indexOf('(nyx_proxy) {');if(start<0||source.indexOf('(nyx_proxy) {',start+1)>=0)throw Error('Expected one Nyx request routing snippet.');
 if(source.includes('@nyx_resource_reads'))throw Error('Resource routing is already installed.');
 const open=source.indexOf('{',start);let depth=1,end=open+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}if(depth)throw Error('Unbalanced Nyx routing snippet.');
 const body=source.slice(open+1,end-1),at=body.indexOf('reverse_proxy 127.0.0.1:8080 {');if(at<0||body.indexOf('reverse_proxy 127.0.0.1:8080 {',at+1)>=0)throw Error('Expected the existing primary Nyx backend.');
 const backend=`reverse_proxy 127.0.0.1:18180 127.0.0.1:18181 {
        lb_policy least_conn
        lb_try_duration 2s
        fail_duration 10s
        max_fails 1
        health_uri /healthz
        health_interval 10s
        health_timeout 2s
        header_up CF-Connecting-IP {client_ip}
        header_up X-NF-Client-Connection-IP {client_ip}
        header_up X-Real-IP {client_ip}
    }`;
 const changed=body.slice(0,at)+`route {
    @nyx_resource_reads {
        method GET HEAD OPTIONS
        path ${resourcePaths.join(' ')}
    }
    handle @nyx_resource_reads {
        ${backend}
    }
    @nyx_resource_alias {
        method GET HEAD OPTIONS
        not path ${resourceExcludedPrefixes.map(p=>p+'*').join(' ')}
        path_regexp nyx_resource_alias "${resourceAliasPattern}"
    }
    handle @nyx_resource_alias {
        ${backend}
    }
    handle {
        ${body.slice(at).trim()}
    }
}\n`;
 return source.slice(0,open+1)+changed+source.slice(end-1);
}
