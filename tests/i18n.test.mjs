// Checks dist/i18n.js: English lives at /en, French at /, and the FR/EN button moves between the two.
// Run with: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../dist/i18n.js',import.meta.url),'utf8');
// Runs i18n.js at an address, with a browser language and a remembered choice.
function open(href,{browser='fr-FR',stored=null}={}){
 const store=new Map(stored?[['gazascale-lang',stored]]:[]),links=[{href:'./',setAttribute(k,v){this[k]=v;}},{href:'./',setAttribute(k,v){this[k]=v;}}];
 const location={href,get pathname(){return new URL(this.href).pathname;},get search(){return new URL(this.href).search;},replaced:null,replace(url){this.replaced=String(url);}};
 const history={state:null,replaceState(state,title,url){location.href=String(new URL(url,location.href));}};
 const button={setAttribute(k,v){this[k]=v;},textContent:''};
 const document={title:'GazaScale',documentElement:{},body:{},getElementById:id=>id==='lang-toggle'?button:null,querySelectorAll:()=>links};
 const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 const window={};
 new Function('window','document','location','history','navigator','localStorage','sessionStorage','t',source)(window,document,location,history,{language:browser},storage,storage,(s)=>s);
 return {lang:window.LANG,address:location.href,button,links,stored:store.get('gazascale-lang'),click(){button.onclick();return location.replaced;}};
}

test('/en shows the site in English and keeps that address', ()=>{
 const page=open('https://gazascale.org/en',{browser:'fr-FR'});
 assert.equal(page.lang,'en');
 assert.equal(page.address,'https://gazascale.org/en');
 assert.equal(page.stored,'en');
 assert.equal(page.button.textContent,'FR');
 assert.ok(page.links.every(a=>a.href==='/en'),'the logo leads back to the English page');
});

test('the FR button goes back to the plain address, in French', ()=>{
 const page=open('https://gazascale.org/en');
 assert.equal(page.click(),'https://gazascale.org/');
 assert.equal(open('https://gazascale.org/',{stored:'fr',browser:'en-US'}).lang,'fr');
});

test('the EN button goes to /en', ()=>{
 const page=open('https://gazascale.org/',{browser:'fr-FR'});
 assert.equal(page.lang,'fr');
 assert.equal(page.button.textContent,'EN');
 assert.equal(page.click(),'https://gazascale.org/en');
});

test('the address always matches the language shown', ()=>{
 // English browser or earlier English choice on the plain address: the address becomes /en.
 assert.equal(open('https://gazascale.org/',{browser:'en-US'}).address,'https://gazascale.org/en');
 assert.equal(open('https://gazascale.org/#source-vies',{stored:'en'}).address,'https://gazascale.org/en#source-vies');
 // Older shared links with ?lang= still work.
 const old=open('https://gazascale.org/?lang=en#v=46,6,0,9,46,6,o,2025,dli');
 assert.equal(old.lang,'en');assert.equal(old.address,'https://gazascale.org/en#v=46,6,0,9,46,6,o,2025,dli');
 const fr=open('https://gazascale.org/?lang=fr',{stored:'en'});
 assert.equal(fr.lang,'fr');assert.equal(fr.address,'https://gazascale.org/');assert.equal(fr.stored,'fr');
});
