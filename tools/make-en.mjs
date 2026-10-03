// Builds dist/index.en.html: the same page with English titles and share previews,
// served by nginx for /?lang=en so that links shared from the English version preview in English.
// Run after any change to dist/index.html: node tools/make-en.mjs
import fs from 'node:fs';
const dist=new URL('../dist/',import.meta.url);
globalThis.window={};
await import(new URL('en.js',dist));
const en=window.EN_STRINGS;
let html=fs.readFileSync(new URL('index.html',dist),'utf8');
const swap=(re,fn)=>{const before=html;html=html.replace(re,fn);if(html===before)throw Error('not found: '+re);};
const tr=fr=>{if(en[fr]===undefined)throw Error('missing English text: '+fr);return en[fr];};
swap('<html lang="fr">','<html lang="en">');
swap(/<title>([^<]*)<\/title>/,(m,t)=>`<title>${tr(t)}</title>`);
swap(/(<meta property="og:title" content=")([^"]*)/,(m,a,t)=>a+tr(t));
swap(/(<meta name="description" content=")([^"]*)/,(m,a)=>a+'Place the Gaza Strip at its true size anywhere in the world and compare areas, populations and sourced human tolls.');
swap(/(<meta property="og:description" content=")([^"]*)/,(m,a)=>a+'Place the Gaza Strip at its true size anywhere in the world and compare areas, populations and sourced human tolls.');
swap('<meta property="og:locale" content="fr_FR">','<meta property="og:locale" content="en_GB">');
swap('<meta property="og:url" content="https://gazascale.org/">','<meta property="og:url" content="https://gazascale.org/?lang=en">');
swap('<link rel="canonical" href="https://gazascale.org/">','<link rel="canonical" href="https://gazascale.org/?lang=en">');
swap(/(<meta property="og:image:alt" content=")([^"]*)/,(m,a)=>a+'Map: the Gaza Strip placed on Chambéry. In red, the municipalities equivalent to the 73,922 lives lost; in yellow, 92 municipalities for the 174,995 injured. Toll reported as of 23 September 2026.');
swap('<meta property="og:image" content="https://gazascale.org/brand/partage.png">','<meta property="og:image" content="https://gazascale.org/brand/partage-en.png">');
fs.writeFileSync(new URL('index.en.html',dist),html);
console.log('dist/index.en.html written');
