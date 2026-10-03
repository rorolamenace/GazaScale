import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
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
  const key=file+':'+(await stat(file)).mtimeMs;
  if(!gzipped.has(key))gzipped.set(key,gzipSync(data));
  res.writeHead(status,{...headers,'Content-Encoding':'gzip','Vary':'Accept-Encoding'}).end(gzipped.get(key));return;
 }
 res.writeHead(status,headers).end(data);
}
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  // Same as production: /live/ comes from the live-data branch (LIVE_DIR=folder to test a local copy).
  if(url.pathname.startsWith('/live/')){
   const rel=url.pathname.slice(6);if(rel.includes('..')){res.writeHead(403).end();return;}
   if(process.env.LIVE_DIR){await send(req,res,path.join(process.env.LIVE_DIR,rel));return;}
   const r=await fetch('https://raw.githubusercontent.com/rorolamenace/GazaScale/live-data/'+rel);
   res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/octet-stream','Cache-Control':'no-cache'}).end(Buffer.from(await r.arrayBuffer()));return;
  }
  const name=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(root,'.'+name);
  if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return;}
  await send(req,res,file);
 }catch{
  try{await send(req,res,path.join(root,'404.html'),404);}catch{res.writeHead(404).end('Not found');}
 }
}).listen(4187,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4187'));
