import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.svg':'image/svg+xml','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.zip':'application/zip'};
const compressible=new Set(['.svg','.html','.js','.css','.json','.webmanifest','.txt','.xml']);
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
const gzipped=new Map();
async function send(req,res,file,status=200){
 const data=await readFile(file),ext=path.extname(file),headers={...security,'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'};
 if(compressible.has(ext)&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){
  if(!gzipped.has(file))gzipped.set(file,gzipSync(data));
  res.writeHead(status,{...headers,'Content-Encoding':'gzip','Vary':'Accept-Encoding'}).end(gzipped.get(file));return;
 }
 res.writeHead(status,headers).end(data);
}
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+name);
  if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}
  await send(req,res,file);
 }catch{
  try{await send(req,res,path.join(root,'404.html'),404);}catch{res.writeHead(404).end('Not found');}
 }
}).listen(4187,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4187'));
