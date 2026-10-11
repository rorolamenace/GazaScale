// Reading of the OCHA "Reported impact snapshot | Gaza Strip", kept apart from the network so it can be tested
// (tests/toll.test.mjs). Used by tools/live/fetch-toll.mjs.
export const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
export const iso=(d,m,y)=>`${y}-${String(MONTHS.indexOf(m.toLowerCase())+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

// Latest Gaza snapshot linked from https://www.ochaopt.org/publications, or null.
export function latestSnapshot(html){
 const found=[...html.matchAll(/\/content\/reported-impact-snapshot-gaza-strip-(\d{1,2})-([a-z]+)-(\d{4})/g)].map(m=>({path:m[0],date:iso(m[1],m[2],m[3])})).filter(s=>!s.date.includes('-00-'));
 return found.sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}

// Toll printed in the snapshot (text from pdftotext), checked against the previous one.
// Throws with every problem found: nothing is published unless the figures are plausible.
export function parseSnapshot(text,old){
 const lines=text.split('\n').map(s=>s.trim());
 const num=s=>/^\d{1,3}(,\d{3})+$/.test(s)?Number(s.replace(/,/g,'')):null;
 // Reported date of the casualty figures.
 const dm=lines.find(l=>/REPORTED CASUALTIES \(Cumulative\) as of/i.test(l))?.match(/as of (\d{1,2}) ([A-Za-z]+) (\d{4})/);
 if(!dm||!MONTHS.includes(dm[2].toLowerCase()))throw Error('casualty date not found');
 const date=iso(dm[1],dm[2],dm[3]);
 // Lives lost: the figure printed just before "Reported fatalities include".
 const fi=lines.findIndex(l=>/^Reported fatalities include/i.test(l));
 let killed=null;for(let i=fi-1;i>=0&&i>fi-6;i--){if(num(lines[i])!==null){killed=num(lines[i]);break;}}
 // Injured: the only standalone figure close above the previous one.
 const injuredCandidates=[...new Set(lines.map(num).filter(v=>v!==null&&v>=old.injured&&v<=old.injured*1.05))];
 const injured=injuredCandidates.length===1?injuredCandidates[0]:null;
 const problems=[];
 if(killed===null||killed<old.killed||killed>old.killed*1.05)problems.push(`lives lost not found or implausible (${killed}, previous ${old.killed})`);
 if(injured===null)problems.push(`injured not found or ambiguous (${injuredCandidates.join(', ')||'none'}, previous ${old.injured})`);
 if(date<=old.date)problems.push(`date ${date} not after ${old.date}`);
 if(problems.length)throw Error(problems.join('; '));
 return {date,killed,injured};
}
