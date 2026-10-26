// Ranking config and scoring, shared by index.html and the tools in tools/.
// Data comes from data/<tab>.json (see tools/lib.mjs for the format).

const CFG={
  books:{base:4.5,noun:'books',creator:'Author',cut:1970,curText:'Current: last 6 months',cutText:'Classics: published before 1970',
    sub:'Books, ranked by readers and listeners',
    lede:'Ranked by a <strong>weighted score</strong> that blends Goodreads, Amazon and Audible ratings, giving more say to ratings backed by more people. Series count once, ranked by their best book.',
    src:[{k:'gr',l:'Goodreads',c:4.1,m:50000,w:.4,f:v=>v.toFixed(2),to5:v=>v,url:q=>'https://www.goodreads.com/search?q='+q},
         {k:'amz',l:'Amazon',c:4.5,m:20000,w:.3,f:v=>v.toFixed(1),to5:v=>v,url:q=>'https://www.amazon.com/s?k='+q+'&i=stripbooks'},
         {k:'aud',l:'Audible',c:4.6,m:10000,w:.3,f:v=>v.toFixed(1),to5:v=>v,url:q=>'https://www.audible.com/search?keywords='+q}],
    caveat:'Audible scores belong to one recording and can differ by narrator; Harry Potter uses the Jim Dale recordings and Dracula the Audible Original. Goodreads and Amazon cover the book itself; for classics with many editions, the most-rated listing is used.',
    awards:'Major prizes (Pulitzer, Booker, Women’s Prize, Hugo, Nebula and a few others) and the reader-voted Goodreads Choice Awards. Awards are shown for context and don’t change the score.',
    foot:'Ratings read from Goodreads, Amazon.com and Audible.com on {date}. Covers from Open Library and may show a different edition.'},
  movies:{base:4.1,noun:'films',creator:'Director',cut:1980,curText:'Current: last 6 months',cutText:'Classics: released before 1980',
    sub:'Films, ranked by audiences',
    lede:'Ranked by a <strong>weighted score</strong> that blends IMDb, Letterboxd and the Rotten Tomatoes audience score, giving more say to ratings backed by more people. Critic scores are not part of it. Anime films are in the Anime tab.',
    src:[{k:'imdb',l:'IMDb',c:3.8,m:100000,w:.4,f:v=>v.toFixed(1),to5:v=>v/2,url:q=>'https://www.imdb.com/find/?q='+q},
         {k:'lbx',l:'Letterboxd',c:3.7,m:100000,w:.35,f:v=>v.toFixed(2),to5:v=>v,url:q=>'https://letterboxd.com/search/films/'+q+'/'},
         {k:'rt',l:'RT audience',c:4.25,m:10000,w:.25,f:v=>v+'%',to5:v=>v/20,url:q=>'https://www.rottentomatoes.com/search?search='+q}],
    caveat:'Letterboxd skews toward film enthusiasts, which flatters older and arthouse films; that is one reason classics get their own list. Rotten Tomatoes counts come from its liked/not-liked totals and can be small for older films, which the volume adjustment accounts for.',
    awards:'Academy Award wins and nominations, read from each film’s IMDb page. Awards are shown for context and don’t change the score.',
    foot:'Ratings read from IMDb, Letterboxd and Rotten Tomatoes on {date}. Posters via IMDb.'},
  games:{base:4.4,noun:'games',creator:'Developer',cut:2005,curText:'Current: last 6 months',cutText:'Classics: released before 2005',
    sub:'Games, ranked by players',
    lede:'Ranked by a <strong>weighted score</strong> that blends Backloggd, Steam user reviews and the Metacritic user score, giving more say to ratings backed by more people. Games not sold on Steam are scored on the other two.',
    src:[{k:'bl',l:'Backloggd',c:3.8,m:20000,w:.35,f:v=>v.toFixed(2),to5:v=>v,url:q=>'https://backloggd.com/search/games/'+q+'/'},
         {k:'steam',l:'Steam',c:4.5,m:50000,w:.35,f:v=>Math.round(v)+'%',to5:v=>v/20,url:q=>'https://store.steampowered.com/search/?term='+q},
         {k:'mc',l:'Metacritic users',c:4.0,m:5000,w:.3,f:v=>v.toFixed(1),to5:v=>v/2,url:q=>'https://www.metacritic.com/search/'+q+'/'}],
    caveat:'Remakes are their own entries (Resident Evil 4 here is the 2023 remake). For classics, Steam counts only where an official PC version exists; some Steam and Metacritic figures come from a re-release of the same game. Steam counts are the store\u2019s All Reviews total across languages.',
    awards:'Game of the Year winners and nominees at The Game Awards (from 2014) and the D.I.C.E. Awards (from 1998). Awards are shown for context and don’t change the score.',
    foot:'Ratings read from Backloggd, Steam and Metacritic on {date}. Box art via IGDB.'},
  tv:{base:4.2,noun:'series',creator:'Creator',cut:1999,curText:'Current: last 6 months',cutText:'Classics: premiered before 1999',
    sub:'TV series, ranked by viewers',
    lede:'Ranked by a <strong>weighted score</strong> that blends IMDb, the Metacritic user score and the Rotten Tomatoes audience score, giving more say to ratings backed by more people. Each show is one entry; seasons and spin-offs aren\u2019t merged. Anime has its own tab.',
    src:[{k:'imdb',l:'IMDb',c:3.8,m:100000,w:.4,f:v=>v.toFixed(1),to5:v=>v/2,url:q=>'https://www.imdb.com/find/?q='+q},
         {k:'mc',l:'Metacritic users',c:4.0,m:2000,w:.3,f:v=>v.toFixed(1),to5:v=>v/2,url:q=>'https://www.metacritic.com/search/'+q+'/'},
         {k:'rt',l:'RT audience',c:4.25,m:10000,w:.3,f:v=>v+'%',to5:v=>v/20,url:q=>'https://www.rottentomatoes.com/search?search='+q}],
    caveat:'Rotten Tomatoes shows a series-wide audience score with a rounded rating count (for example \u201c25,000+\u201d), so its counts are approximate. The 1999 cutoff marks the start of the modern prestige-TV era, which began with The Sopranos. Long-running shows are judged on their overall ratings, not their best season.',
    awards:'Primetime Emmy wins and nominations (BAFTA TV Awards for British shows without Emmy recognition), read from each show\u2019s IMDb page. Awards are shown for context and don\u2019t change the score.',
    foot:'Ratings read from IMDb, Metacritic and Rotten Tomatoes on {date}. Posters via IMDb.'},
  anime:{base:4.3,noun:'anime',creator:'Studio',cut:2000,curText:'Current: last 6 months',cutText:'Classics: premiered before 2000',
    sub:'Anime, ranked by fans',
    lede:'Ranked by a <strong>weighted score</strong> that blends MyAnimeList, AniList and IMDb, giving more say to ratings backed by more people. A show with several seasons counts once, ranked by its best season. Anime films are here too, as single entries.',
    src:[{k:'mal',l:'MyAnimeList',c:3.9,m:100000,w:.4,f:v=>v.toFixed(2),to5:v=>v/2,url:q=>'https://myanimelist.net/anime.php?q='+q},
         {k:'al',l:'AniList',c:3.9,m:50000,w:.3,f:v=>v+'%',to5:v=>v/20,url:q=>'https://anilist.co/search/anime?search='+q},
         {k:'imdb',l:'IMDb',c:3.8,m:30000,w:.3,f:v=>v.toFixed(1),to5:v=>v/2,url:q=>'https://www.imdb.com/find/?q='+q}],
    caveat:'MyAnimeList and AniList rate each season separately, but IMDb rates the whole show, so every season of a show shares its IMDb number. AniList\u2019s count is how many people have the show on their list, not how many rated it, so it is used only as a guide to volume. Very long shows without seasons (One Piece, Detective Conan) are one entry rated as a whole. Recaps and spin-offs are left out. Anime films (Ghibli and others) live here rather than in Movies, and anime series aren\u2019t repeated in the TV Series tab.',
    awards:'Anime of the Year at the Crunchyroll Anime Awards (from 2017), the largest fan-voted anime awards, and Academy Awards for anime films. Awards are shown for context and don\u2019t change the score.',
    foot:'Ratings read from MyAnimeList, AniList and IMDb on {date}. Key art via AniList.'}
};

/* ---------- Site pages ---------- */
// A work's page on a site, from the id in its ids:{}; null means link to a search instead
const PAGE={gr:i=>'https://www.goodreads.com/book/show/'+i,amz:i=>'https://www.amazon.com/dp/'+i,aud:i=>'https://www.audible.com/pd/'+i,
  imdb:i=>'https://www.imdb.com/title/'+i+'/',lbx:i=>'https://letterboxd.com/film/'+i+'/',rt:i=>'https://www.rottentomatoes.com/'+i,
  bl:i=>'https://backloggd.com/games/'+i+'/',steam:i=>'https://store.steampowered.com/app/'+i+'/',mc:i=>'https://www.metacritic.com/'+i+'/',
  mal:i=>'https://myanimelist.net/anime/'+i,al:i=>'https://anilist.co/anime/'+i};
function pageUrl(k,ids){
  if(ids&&ids[k])return PAGE[k](ids[k]);
  if(k==='lbx'&&ids&&ids.imdb)return 'https://letterboxd.com/imdb/'+ids.imdb+'/';
  return null;
}

/* ---------- Scoring ---------- */
function scoreOf(s,src,base){
  let sum=0,wt=0;
  for(const p of src){const v=s[p.k];if(!v)continue;const r=p.to5(v[0]);const adj=(v[1]/(v[1]+p.m))*r+(p.m/(v[1]+p.m))*p.c;sum+=p.w*(adj-p.c);wt+=p.w;}
  return wt?base+sum/wt:null;
}
// One data file → {M,C,N} lists of entries; a series entry carries its works in .books
function expand(d){
  const out={};
  for(const e in d.lists)out[e]=d.lists[e].map(id=>{
    const ser=d.series[id];
    if(!ser)return {id,...d.works[id]};
    return {id,...ser,members:undefined,books:ser.members.map(m=>({id:m.w,...d.works[m.w],no:m.no}))};
  });
  return out;
}
function rankList(m,list){
  const src=CFG[m].src;
  list.forEach(x=>{
    if(x.books){
      x.books.forEach(b=>b.score=scoreOf(b.s,src,CFG[m].base));
      x.best=x.books.reduce((a,b)=>b.score>a.score?b:a);x.score=x.best.score;x.s=x.best.s;
      x.years=x.books.map(b=>b.y);x.y=Math.max(...x.years);x.y0=Math.min(...x.years);
      x.aw=x.books.flatMap(b=>(b.aw||[]).map(a=>a));
    }else{x.score=scoreOf(x.s,src,CFG[m].base);x.years=[x.y];}
    const v=src.filter(p=>x.s[p.k]).map(p=>p.to5(x.s[p.k][0]));x.spread=v.length>1?Math.max(...v)-Math.min(...v):0;
    x.win=(x.aw||[]).some(a=>!/nominee|nomination/i.test(a)||/^Won/.test(a));
  });
  [...list].sort((a,b)=>b.score-a.score).forEach((x,i)=>x.rank=i+1);
  return list;
}
// Earliest and latest date any rating in a tab was read
function checkedRange(d){
  let lo='9999',hi='0000';
  for(const w of Object.values(d.works))for(const v of Object.values(w.s))if(v[2]){if(v[2]<lo)lo=v[2];if(v[2]>hi)hi=v[2];}
  return [lo,hi];
}
if(typeof module!=='undefined')module.exports={CFG,PAGE,pageUrl,scoreOf,expand,rankList,checkedRange};
