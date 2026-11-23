// 로컬 화면 검토 전용. 확장 프로그램 실행에는 필요 없다.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
http.createServer((request,response)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);}catch{response.writeHead(400).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/app.html':pathname));
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(data);});
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173/app.html?demo=1'));
