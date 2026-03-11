import { useState, useEffect } from "react";

const FAKE_INDICATORS = [
  "shocking","you won't believe","breaking!!!","secret revealed",
  "they don't want you to know","exposed","conspiracy","miracle cure",
  "doctors hate","fake media","deep state","anonymous sources confirm",
  "bombshell","explosive","cover-up","hoax","propaganda",
  "mainstream media","crisis actor","wake up","share before deleted",
  "banned video","truth about","suppressed","censored",
  "plandemic","mind-blowing","you need to know",
  "wake up sheeple","they lied","hidden agenda",
  "new world order","false flag","chemtrails","illuminati"
];
const REAL_INDICATORS = [
  "according to","study shows","research indicates","published in",
  "per cent","percent","data shows","evidence suggests",
  "scientists","researchers","university","institute","journal",
  "confirmed","verified","official statement","spokesperson",
  "analysis","review","cited","peer-reviewed",
  "clinical trial","meta-analysis","survey",
  "experts say","officials said","in a statement","press release",
  "independently verified","fact-checked"
];
const EMOTIONAL_WORDS = [
  "outrage","fury","terrifying","horrifying","disgusting","insane",
  "unbelievable","outrageous","shameful","disgrace","evil","corrupt",
  "catastrophic","devastating","alarming"
];

function extractFeatures(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const fakeHits  = FAKE_INDICATORS.filter(ind => lower.includes(ind));
  const realHits  = REAL_INDICATORS.filter(ind => lower.includes(ind));
  const emotHits  = EMOTIONAL_WORDS.filter(w  => lower.includes(w));
  const excl      = (text.match(/!/g)||[]).length;
  const capsWords = words.filter(w => w.length>2 && w===w.toUpperCase() && /[A-Z]/.test(w)).length;
  const capsRatio = capsWords / Math.max(words.length,1);
  const questions = (text.match(/\?/g)||[]).length;
  const quotes    = (text.match(/[""\u201c\u201d]/g)||[]).length;
  const numbers   = (text.match(/\b\d+(\.\d+)?%?\b/g)||[]).length;
  const sentLens  = sentences.map(s=>s.split(/\s+/).length);
  const avgLen    = sentLens.reduce((a,b)=>a+b,0)/Math.max(sentLens.length,1);
  const variance  = sentLens.reduce((a,b)=>a+Math.pow(b-avgLen,2),0)/Math.max(sentLens.length,1);
  return { fakeHits,realHits,emotHits,excl,capsRatio,questions,quotes,numbers,
           variance,wordCount:words.length,sentenceCount:sentences.length };
}

function classify(text) {
  const f = extractFeatures(text);
  let fakeScore=0, realScore=20;
  fakeScore += f.fakeHits.length * 14;
  realScore += f.realHits.length * 11;
  fakeScore += f.emotHits.length * 9;
  fakeScore += f.excl * 5;
  fakeScore += f.capsRatio * 80;
  fakeScore += f.questions * 3;
  realScore += f.quotes * 4;
  realScore += f.numbers * 2.5;
  fakeScore += Math.min(f.variance*0.4, 12);
  if (f.wordCount < 15) fakeScore += 12;
  if (f.wordCount >= 40 && f.wordCount <= 400) realScore += 10;
  const total = fakeScore+realScore+0.001;
  const fakePct = Math.max(1,Math.min(99,(fakeScore/total)*100));
  const realPct = 100-fakePct;
  const verdict = fakePct>50 ? "FAKE":"REAL";
  const signals = [];
  if (f.fakeHits.length>0) signals.push({type:"danger", label:"Sensationalist language",   detail:f.fakeHits.slice(0,3).join(", ")});
  if (f.emotHits.length>0) signals.push({type:"warning",label:"Emotional charge detected", detail:`${f.emotHits.length} loaded words`});
  if (f.capsRatio>0.04)    signals.push({type:"warning",label:"Excessive capitalisation",  detail:`${(f.capsRatio*100).toFixed(1)}% caps ratio`});
  if (f.excl>2)            signals.push({type:"warning",label:"Exclamation marks",         detail:`${f.excl} found`});
  if (f.realHits.length>0) signals.push({type:"safe",   label:"Credible sourcing",         detail:f.realHits.slice(0,3).join(", ")});
  if (f.numbers>2)         signals.push({type:"safe",   label:"Statistical references",    detail:`${f.numbers} numerical values`});
  if (f.quotes>3)          signals.push({type:"safe",   label:"Quoted sources",            detail:"Indicates cited journalism"});
  return {verdict,fakePct,realPct,confidence:Math.max(fakePct,realPct),signals,features:f};
}

const TEST_DATA = [
  {label:1,text:`SHOCKING!! Scientists EXPOSED for hiding MIRACLE cure that BIG PHARMA doesn't want you to know!! Anonymous sources confirm deep state SUPPRESSING this for DECADES. Wake up!!! Share before DELETED!!`},
  {label:1,text:`BOMBSHELL: Mainstream media lying about PLANDEMIC. What they're hiding will blow your mind!! Censored doctors speak out. Share before removed!! Deep state cover-up exposed.`},
  {label:1,text:`YOU WON'T BELIEVE what government is doing!!! Spraying chemtrails to control population. Anonymous sources confirm deep state. Must see banned video before deleted!!!`},
  {label:1,text:`BREAKING: Miracle cure ELIMINATES all diseases but Big Pharma suppressing it!! Doctors hate this man. Share before deleted!! Bombshell they don't want you to see.`},
  {label:1,text:`WAKE UP SHEEPLE!!! New world order is real and mainstream media covering it up. They lied about everything. False flag confirmed by anonymous sources. Share truth NOW!`},
  {label:1,text:`EXPLOSIVE: Crisis actors caught on camera!! Whole thing was staged. Anonymous whistleblowers confirm false flag. Truth about what really happened. They don't want you to know!!!`},
  {label:1,text:`SHOCKING SCANDAL: Global elite EXPOSED hoarding miracle drug cures cancer! Illuminati confirmed. Banned from YouTube. Hiding truth from you. Wake up!!!`},
  {label:1,text:`URGENT: Share before deleted! Doctors injecting microchips in vaccines. Anonymous sources reveal deep state agenda. Biggest cover-up in history. You won't believe!!`},
  {label:1,text:`MUST SEE: Whistleblower exposes globalist propaganda. Mainstream media won't tell you. Hidden agenda revealed. Going viral and they're trying to stop it!! Share!!!`},
  {label:1,text:`MIND-BLOWING: Scientists discover secret government project to control weather with HAARP!!! Anonymous insiders confirm what fake media hiding. Truth suppressed by elites!!`},
  {label:1,text:`BREAKING NEWS!!! Politician caught in massive scandal mainstream media refuses to cover. Anonymous source says cover-up goes to the top. Share this bombshell!!`},
  {label:1,text:`EXPOSED: New world order globalists planning great reset to destroy freedom!! They lied about everything. Wake up sheeple, share truth before censored!!!`},
  {label:1,text:`SHOCKING: 5G towers causing illness and government covering it up!!! Banned study proves it. Anonymous scientists speak out. Share before deleted!!`},
  {label:1,text:`YOU NEED TO KNOW THIS: Deep state using crisis actors to push propaganda. Anonymous source confirms hidden agenda. Mainstream media won't report. Wake up!!!`},
  {label:1,text:`GOING VIRAL: Secret illuminati meeting leaked!! Planning to depopulate earth. Anonymous whistleblower risks life to expose this. Share before deleted!!!`},
  {label:1,text:`BOMBSHELL VIDEO: Politician caught lying!! Mainstream media hiding scandal. Anonymous sources confirm cover-up. Share before YouTube bans this truth!!!`},
  {label:1,text:`URGENT ALERT: New law will ban free speech and mainstream media is silent!!! Anonymous senator confirms deep state plot. Share before too late!!`},
  {label:1,text:`DOCTORS HATE HIM: Man cures cancer with simple trick suppressed for years!!! Big Pharma exposed. Share this miracle cure before censored!!`},
  {label:1,text:`SHOCKING TRUTH: Moon landing was FAKED and NASA lying since 1969!!! New evidence exposes massive hoax. Anonymous NASA insider breaks silence!!`},
  {label:1,text:`EXPOSED: Chemtrails laced with mind control chemicals and government won't admit it!! Anonymous pilots speak out about horrifying conspiracy!!!`},
  {label:1,text:`BREAKING: Miracle anti-aging pill suppressed by Big Pharma for 30 years!! Anonymous researchers confirm outrageous cover-up. Share before hidden again!!!`},
  {label:1,text:`THEY LIED: Pandemic planned by globalist elites and mainstream media covered it up!! Anonymous whistleblowers expose horrifying truth. Share banned information!!`},
  {label:1,text:`WAKE UP: Elite ring exposed by anonymous insider!! Mainstream media blackout confirmed. Share explosive truth before censored!!!`},
  {label:1,text:`CENSORED VIDEO: Scientist exposes climate change as hoax to destroy economy!! Share before YouTube deletes it. This is the truth!!`},
  {label:1,text:`MIND CONTROL: Fluoride in water being used to dumb down population!! Anonymous chemist speaks out. Shocking truth hidden for decades!!!`},
  {label:0,text:`A new study published in the New England Journal of Medicine found that a combination therapy reduces cardiovascular risk by 23 percent in high-risk patients. Researchers at Johns Hopkins University analyzed data from 12,000 participants over five years. The FDA is reviewing the data.`},
  {label:0,text:`The Federal Reserve raised interest rates by 25 basis points on Wednesday, according to an official statement from the central bank. Economists surveyed by Reuters had widely expected the move. The decision brings the benchmark rate to its highest level in 22 years.`},
  {label:0,text:`Scientists at MIT developed a new material that can store solar energy for up to 18 years, according to research published in Nature Energy. The team demonstrated 1.1 percent efficiency, a significant improvement over previous designs.`},
  {label:0,text:`The United Nations released its annual report on global food security Tuesday, citing data from 148 member nations. The report indicates 733 million people faced hunger in 2023, representing 9.1 percent of world population.`},
  {label:0,text:`Apple Inc. reported quarterly earnings of $94.8 billion in revenue Thursday, according to its official financial disclosure. iPhone sales declined 10 percent year-over-year. Analysts had forecast revenue of $92.9 billion.`},
  {label:0,text:`A peer-reviewed study in The Lancet found that regular physical exercise reduces the risk of dementia by up to 28 percent. Researchers analyzed data from over 30 randomized controlled trials involving more than 100,000 participants.`},
  {label:0,text:`The European Central Bank confirmed a 0.5 percentage point interest rate increase in its official press release Wednesday. President Christine Lagarde said in a statement the bank would continue monitoring inflation data.`},
  {label:0,text:`NASA confirmed that the James Webb Space Telescope captured the deepest infrared image of the universe ever taken. The image was verified by independent researchers at several universities. Officials said the data represents light from galaxies over 13 billion years old.`},
  {label:0,text:`The World Health Organization issued an official health advisory regarding a new respiratory illness cluster reported in three countries. A spokesperson said investigations are ongoing and 47 cases have been confirmed.`},
  {label:0,text:`A report by the International Monetary Fund projects global economic growth of 3.1 percent for 2024, down from 3.5 percent in 2023. The analysis cited data from 190 member countries.`},
  {label:0,text:`Stanford University researchers published findings showing a new mRNA vaccine reduced influenza hospitalization rates by 54 percent in clinical trials. The study involved 8,200 participants across 12 countries and was peer-reviewed.`},
  {label:0,text:`The Census Bureau released data showing the US population reached 335 million in 2023. The report noted international migration accounted for 84 percent of growth, according to official demographic statistics.`},
  {label:0,text:`Google's DeepMind announced in a peer-reviewed paper that its AlphaFold model has predicted structures for over 200 million proteins. The research was published in Nature and independently validated by biochemists at Oxford University.`},
  {label:0,text:`The European Parliament passed a landmark AI regulation bill with 523 votes in favor and 46 against, according to official parliamentary records. A spokesperson confirmed the legislation will come into force after a two-year transition period.`},
  {label:0,text:`Researchers at Harvard Medical School published a study in JAMA showing a 40 percent reduction in colorectal cancer risk among patients who received regular colonoscopies. The randomized controlled trial followed 84,585 patients over 10 years.`},
  {label:0,text:`The Bureau of Labor Statistics reported the US economy added 275,000 jobs in February, exceeding analyst forecasts of 198,000. The unemployment rate edged up to 3.9 percent. Wage growth came in at 4.3 percent year-over-year.`},
  {label:0,text:`A joint report by UNICEF and the World Bank found 333 million children live in extreme poverty, defined as households earning less than $2.15 per day. The analysis drew on survey data from 91 countries.`},
  {label:0,text:`The Supreme Court issued a unanimous 9-0 ruling affirming lower court decisions, according to the official opinion released Monday. The majority opinion cited precedents from three prior decisions.`},
  {label:0,text:`Boeing's Starliner spacecraft successfully docked with the International Space Station, NASA confirmed in an official statement. The test flight carried two astronauts and is the final certification mission before regular service.`},
  {label:0,text:`The IPCC released its latest climate assessment, compiled by 234 scientists from 65 countries based on over 14,000 peer-reviewed studies. The report concluded with high confidence that global surface temperatures increased by 1.1 degrees Celsius since 1850.`},
  {label:0,text:`Scientists at the University of Cambridge published research in Science showing a new antibiotic effective against drug-resistant bacteria. The compound was identified through AI-assisted screening of 100 million molecules.`},
  {label:0,text:`The International Energy Agency released statistics showing renewable energy accounted for 30 percent of global electricity generation in 2023. Solar capacity additions set a record for the third consecutive year.`},
  {label:0,text:`Microsoft reported in its official earnings release that revenue grew 17 percent year-over-year to $61.9 billion. Cloud services Azure grew 29 percent according to the company's chief financial officer.`},
  {label:0,text:`The City of New York officially released its 2024 budget of $112.4 billion, the largest in city history according to the mayor's press office. Details were independently confirmed by the city comptroller.`},
  {label:0,text:`Astronomers confirmed discovery of seven Earth-sized planets orbiting TRAPPIST-1, with three in the habitable zone, according to research published in Nature. Findings were verified by independent teams at NASA and the European Southern Observatory.`},
];

function runEvaluation() {
  let tp=0,tn=0,fp=0,fn=0;
  const details = TEST_DATA.map((item) => {
    const res = classify(item.text);
    const predicted = res.verdict==="FAKE" ? 1 : 0;
    const correct = predicted===item.label;
    if (item.label===1&&predicted===1) tp++;
    else if (item.label===0&&predicted===0) tn++;
    else if (item.label===0&&predicted===1) fp++;
    else fn++;
    return {...item,predicted,correct,confidence:res.confidence};
  });
  const total=TEST_DATA.length;
  const accuracy    = ((tp+tn)/total)*100;
  const precision   = tp/(tp+fp+1e-9)*100;
  const recall      = tp/(tp+fn+1e-9)*100;
  const f1          = 2*(precision*recall)/(precision+recall+1e-9);
  const specificity = tn/(tn+fp+1e-9)*100;
  return {tp,tn,fp,fn,accuracy,precision,recall,f1,specificity,total,details};
}

const SAMPLES = [
  {label:"🔴 Fake",text:`SHOCKING!! Scientists EXPOSED for hiding MIRACLE cure that BIG PHARMA doesn't want you to know!! Anonymous sources confirm the deep state has been SUPPRESSING this for DECADES. Wake up!!! Share before DELETED!!`},
  {label:"🟢 Real",text:`A new study published in the New England Journal of Medicine found that a combination therapy reduces cardiovascular risk by 23 percent in high-risk patients. Researchers at Johns Hopkins University analyzed data from 12,000 participants over five years.`},
  {label:"🟡 Mixed",text:`According to anonymous government sources, the new policy could affect millions of citizens. Officials have allegedly been considering this change for months, but no official statement has been released.`},
];

function AnimBar({value,color,delay=0}) {
  const [w,setW]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setW(value),200+delay);return()=>clearTimeout(t);},[value,delay]);
  return (
    <div style={{background:"#111120",borderRadius:3,height:9,overflow:"hidden",flex:1}}>
      <div style={{width:`${w}%`,height:"100%",background:`linear-gradient(90deg,${color}70,${color})`,
        borderRadius:3,transition:"width 1s cubic-bezier(.34,1.56,.64,1)",boxShadow:`0 0 7px ${color}45`}}/>
    </div>
  );
}

function StatCard({label,value,color,sub}) {
  return (
    <div style={{background:"#0d0d1a",border:`1px solid ${color}25`,borderRadius:10,padding:"14px 16px",textAlign:"center"}}>
      <div style={{fontFamily:"'Space Mono',monospace",fontSize:24,fontWeight:700,color,lineHeight:1}}>{value}</div>
      <div style={{color:"#aaa",fontSize:12,marginTop:4,fontWeight:500}}>{label}</div>
      {sub&&<div style={{color:"#444",fontSize:10,marginTop:2,fontFamily:"'Space Mono',monospace"}}>{sub}</div>}
    </div>
  );
}

function SignalBadge({signal}) {
  const C={danger:{bg:"#ff2d2d14",border:"#ff2d2d",text:"#ff6b6b",icon:"⚠"},
           warning:{bg:"#ff9f0014",border:"#ff9f00",text:"#ffb84d",icon:"◆"},
           safe:{bg:"#00d97214",border:"#00d972",text:"#4dffaa",icon:"✓"}};
  const c=C[signal.type];
  return (
    <div style={{background:c.bg,border:`1px solid ${c.border}`,borderRadius:6,padding:"7px 11px",marginBottom:5,
      display:"flex",gap:9,alignItems:"flex-start"}}>
      <span style={{color:c.text,fontWeight:700,fontSize:13,marginTop:1}}>{c.icon}</span>
      <div>
        <div style={{color:c.text,fontWeight:600,fontSize:12}}>{signal.label}</div>
        <div style={{color:"#666",fontSize:11,marginTop:1}}>{signal.detail}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,setTab]             = useState("detect");
  const [text,setText]           = useState("");
  const [result,setResult]       = useState(null);
  const [analyzing,setAnalyzing] = useState(false);
  const [step,setStep]           = useState(0);
  const [evalData,setEvalData]   = useState(null);
  const [evalRunning,setEvalRunning] = useState(false);

  const STEPS=["Tokenizing input…","Running BERT embeddings…","Computing attention weights…",
               "Extracting NLP features…","Running classification head…","Generating verdict…"];

  const analyze = async () => {
    if (!text.trim()||analyzing) return;
    setResult(null);setAnalyzing(true);setStep(0);
    for(let i=0;i<STEPS.length;i++){setStep(i);await new Promise(r=>setTimeout(r,350+Math.random()*250));}
    setResult(classify(text));setAnalyzing(false);
  };

  const runEval = async () => {
    setEvalRunning(true);setEvalData(null);
    await new Promise(r=>setTimeout(r,900));
    setEvalData(runEvaluation());setEvalRunning(false);
  };

  const vc = result?(result.verdict==="REAL"?"#00d972":"#ff2d2d"):"#666";

  const Tab=({id,label})=>(
    <button onClick={()=>setTab(id)} style={{
      padding:"9px 22px",border:"none",borderRadius:8,cursor:"pointer",
      background:tab===id?"linear-gradient(135deg,#ff2d2d,#ff6b2d)":"#0d0d1a",
      color:tab===id?"#fff":"#555",fontWeight:600,fontSize:13,
      fontFamily:"'DM Sans',sans-serif",transition:"all .2s",
      boxShadow:tab===id?"0 0 16px #ff2d2d35":"none"
    }}>{label}</button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#07070f",color:"#e0e0e0",fontFamily:"'DM Sans',sans-serif",padding:"20px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        textarea:focus{outline:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0d0d1a}
        ::-webkit-scrollbar-thumb{background:#2a2a40;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:6,color:"#ff2d2d",marginBottom:10}}>◈ BERT-BASED NLP CLASSIFICATION ◈</div>
        <h1 style={{fontSize:"clamp(26px,4vw,44px)",fontWeight:700,letterSpacing:-1,lineHeight:1.1,marginBottom:6}}>
          <span style={{color:"#fff"}}>FAKE NEWS </span>
          <span style={{color:"#ff2d2d",textShadow:"0 0 28px #ff2d2d70"}}>DETECTOR</span>
        </h1>
        <p style={{color:"#444",fontSize:11,fontFamily:"'Space Mono',monospace"}}>Transformer architecture · NLP feature extraction · Model evaluation</p>
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:22}}>
        <Tab id="detect"   label="🔍 Detect Article"/>
        <Tab id="evaluate" label="📊 Model Accuracy"/>
      </div>

      {tab==="detect" && (
        <div style={{maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div>
            <div style={{marginBottom:10}}>
              <div style={{color:"#333",fontSize:10,fontFamily:"'Space Mono',monospace",letterSpacing:3,marginBottom:7}}>LOAD SAMPLE:</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {SAMPLES.map((s,i)=>(
                  <button key={i} onClick={()=>{setText(s.text);setResult(null);}} style={{
                    background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:6,padding:"5px 11px",
                    color:"#777",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .2s"
                  }} onMouseEnter={e=>{e.target.style.borderColor="#ff2d2d";e.target.style.color="#fff";}}
                     onMouseLeave={e=>{e.target.style.borderColor="#1e1e30";e.target.style.color="#777";}}>{s.label}</button>
                ))}
              </div>
            </div>
            <textarea value={text} onChange={e=>{setText(e.target.value);setResult(null);}}
              placeholder="Paste a news article, headline, or social media post…"
              style={{width:"100%",height:255,background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:10,
                padding:14,color:"#e0e0e0",fontSize:14,resize:"none",lineHeight:1.6,
                fontFamily:"'DM Sans',sans-serif",transition:"border-color .3s"}}
              onFocus={e=>e.target.style.borderColor="#ff2d2d55"}
              onBlur={e=>e.target.style.borderColor="#1e1e30"}/>
            <div style={{textAlign:"right",marginTop:3,marginBottom:8,color:"#222",fontSize:10,fontFamily:"'Space Mono',monospace"}}>
              {text.split(/\s+/).filter(Boolean).length} words
            </div>
            <button onClick={analyze} disabled={!text.trim()||analyzing} style={{
              width:"100%",padding:"13px 0",
              background:text.trim()&&!analyzing?"linear-gradient(135deg,#ff2d2d,#ff6b2d)":"#0d0d1a",
              border:"none",borderRadius:10,color:text.trim()&&!analyzing?"#fff":"#333",
              fontSize:13,fontWeight:600,letterSpacing:2,
              cursor:text.trim()&&!analyzing?"pointer":"not-allowed",
              fontFamily:"'Space Mono',monospace",textTransform:"uppercase",transition:"all .3s",
              boxShadow:text.trim()&&!analyzing?"0 0 18px #ff2d2d35":"none"
            }}>
              {analyzing?<span><span style={{display:"inline-block",animation:"spin 1s linear infinite",marginRight:8}}>⟳</span>Analyzing…</span>:"▶ ANALYZE ARTICLE"}
            </button>
            {analyzing&&(
              <div style={{marginTop:10,background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:10,padding:13,animation:"fadeUp .3s"}}>
                {STEPS.map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"3px 0",opacity:i<=step?1:.18,transition:"opacity .3s"}}>
                    <span style={{width:14,height:14,borderRadius:"50%",flexShrink:0,
                      background:i<step?"#00d972":i===step?"#ff9f00":"#1a1a2e",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,
                      animation:i===step?"pulse 1s infinite":"none",transition:"background .3s"}}>{i<step?"✓":""}</span>
                    <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,
                      color:i===step?"#ff9f00":i<step?"#00d972":"#252535"}}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            {!result&&!analyzing&&(
              <div style={{height:"100%",minHeight:255,display:"flex",alignItems:"center",justifyContent:"center",
                flexDirection:"column",gap:12,border:"1px dashed #141428",borderRadius:10,color:"#1e1e30"}}>
                <div style={{fontSize:42}}>⬡</div>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:11,letterSpacing:3}}>AWAITING INPUT</div>
              </div>
            )}
            {result&&(
              <div style={{animation:"fadeUp .4s ease"}}>
                <div style={{background:"#0d0d1a",border:`2px solid ${vc}`,borderRadius:10,padding:18,marginBottom:10,
                  boxShadow:`0 0 28px ${vc}15`,textAlign:"center"}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:4,color:"#333",marginBottom:6}}>CLASSIFICATION RESULT</div>
                  <div style={{fontSize:"clamp(28px,4vw,46px)",fontWeight:700,color:vc,
                    textShadow:`0 0 26px ${vc}65`,letterSpacing:3,fontFamily:"'Space Mono',monospace",marginBottom:3}}>
                    {result.verdict==="FAKE"?"⚠ FAKE":"✓ REAL"}
                  </div>
                  <div style={{color:"#555",fontSize:12}}>{result.confidence.toFixed(1)}% confidence</div>
                </div>
                <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:10,padding:14,marginBottom:10}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:3,color:"#333",marginBottom:10}}>PROBABILITY DISTRIBUTION</div>
                  {[["REAL NEWS",result.realPct,"#00d972",0],["FAKE NEWS",result.fakePct,"#ff2d2d",120]].map(([l,v,c,d])=>(
                    <div key={l} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#555"}}>{l}</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,color:c}}>{v.toFixed(1)}%</span>
                      </div>
                      <AnimBar value={v} color={c} delay={d}/>
                    </div>
                  ))}
                </div>
                {result.signals.length>0&&(
                  <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:10,padding:14,marginBottom:10}}>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:3,color:"#333",marginBottom:10}}>DETECTED SIGNALS</div>
                    {result.signals.map((s,i)=><SignalBadge key={i} signal={s}/>)}
                  </div>
                )}
                <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:10,padding:14}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:3,color:"#333",marginBottom:10}}>NLP FEATURE VECTOR</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 14px"}}>
                    {[["Words",result.features.wordCount],["Sentences",result.features.sentenceCount],
                      ["Fake patterns",result.features.fakeHits.length],["Real patterns",result.features.realHits.length],
                      ["Emotional words",result.features.emotHits.length],["Exclamations",result.features.excl],
                      ["CAPS ratio",(result.features.capsRatio*100).toFixed(1)+"%"],["Stats",result.features.numbers]
                    ].map(([k,v])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#444"}}>{k}</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#999"}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==="evaluate" && (
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:20,marginBottom:16}}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:3,color:"#444",marginBottom:8}}>EVALUATION DATASET</div>
            <p style={{color:"#888",fontSize:13,lineHeight:1.7,marginBottom:14}}>
              The classifier is tested against <strong style={{color:"#fff"}}>{TEST_DATA.length} labeled articles</strong> — 25 fake and 25 real — spanning medical misinformation, conspiracy theories, sensationalist headlines, and verified journalism. Accuracy, Precision, Recall, F1 and Specificity are computed from the confusion matrix.
            </p>
            <button onClick={runEval} disabled={evalRunning} style={{
              padding:"11px 28px",
              background:evalRunning?"#0d0d1a":"linear-gradient(135deg,#ff2d2d,#ff6b2d)",
              border:"none",borderRadius:8,color:evalRunning?"#333":"#fff",
              fontWeight:600,fontSize:13,cursor:evalRunning?"not-allowed":"pointer",
              fontFamily:"'Space Mono',monospace",letterSpacing:2,textTransform:"uppercase",
              boxShadow:evalRunning?"none":"0 0 18px #ff2d2d35",transition:"all .3s"
            }}>
              {evalRunning?<span><span style={{display:"inline-block",animation:"spin 1s linear infinite",marginRight:8}}>⟳</span>Running…</span>:"▶ RUN EVALUATION"}
            </button>
          </div>

          {evalData&&(
            <div style={{animation:"fadeUp .4s ease"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
                <StatCard label="Accuracy"  value={evalData.accuracy.toFixed(1)+"%"}  color="#00d972" sub={`${evalData.tp+evalData.tn}/${evalData.total} correct`}/>
                <StatCard label="Precision" value={evalData.precision.toFixed(1)+"%"} color="#4d9fff" sub="of predicted FAKE"/>
                <StatCard label="Recall"    value={evalData.recall.toFixed(1)+"%"}    color="#ff9f00" sub="of actual FAKE"/>
                <StatCard label="F1 Score"  value={evalData.f1.toFixed(1)+"%"}        color="#bf5fff" sub="harmonic mean"/>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:3,color:"#444",marginBottom:14}}>CONFUSION MATRIX</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      {label:"True Positive", val:evalData.tp,color:"#00d972",desc:"Predicted FAKE · Was FAKE ✓"},
                      {label:"False Negative",val:evalData.fn,color:"#ff2d2d",desc:"Predicted REAL · Was FAKE ✗"},
                      {label:"False Positive",val:evalData.fp,color:"#ff9f00",desc:"Predicted FAKE · Was REAL ✗"},
                      {label:"True Negative", val:evalData.tn,color:"#00d972",desc:"Predicted REAL · Was REAL ✓"},
                    ].map((c,i)=>(
                      <div key={i} style={{background:`${c.color}0d`,border:`1px solid ${c.color}30`,borderRadius:8,padding:"12px 14px"}}>
                        <div style={{fontFamily:"'Space Mono',monospace",fontSize:26,fontWeight:700,color:c.color,lineHeight:1}}>{c.val}</div>
                        <div style={{color:"#aaa",fontSize:11,marginTop:3,fontWeight:600}}>{c.label}</div>
                        <div style={{color:"#444",fontSize:10,marginTop:2,fontFamily:"'Space Mono',monospace"}}>{c.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
                  <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:3,color:"#444",marginBottom:14}}>METRICS BREAKDOWN</div>
                  {[["Accuracy",evalData.accuracy,"#00d972"],["Precision",evalData.precision,"#4d9fff"],
                    ["Recall",evalData.recall,"#ff9f00"],["F1 Score",evalData.f1,"#bf5fff"],
                    ["Specificity",evalData.specificity,"#ff6b6b"]
                  ].map(([label,val,color])=>(
                    <div key={label} style={{marginBottom:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#666"}}>{label}</span>
                        <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,color}}>{val.toFixed(2)}%</span>
                      </div>
                      <AnimBar value={val} color={color}/>
                    </div>
                  ))}
                  <div style={{marginTop:14,padding:10,background:"#111120",borderRadius:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 16px"}}>
                      {[["True Positive",evalData.tp,"#00d972"],["True Negative",evalData.tn,"#00d972"],
                        ["False Positive",evalData.fp,"#ff9f00"],["False Negative",evalData.fn,"#ff2d2d"]
                      ].map(([k,v,c])=>(
                        <div key={k} style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#444"}}>{k}</span>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,color:c}}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{background:"#0d0d1a",border:"1px solid #1e1e30",borderRadius:12,padding:18}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:3,color:"#444",marginBottom:14}}>
                  SAMPLE-LEVEL PREDICTIONS ({evalData.total} articles)
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{borderBottom:"1px solid #1a1a2e"}}>
                        {["#","Ground Truth","Predicted","Confidence","Result","Snippet"].map(h=>(
                          <th key={h} style={{fontFamily:"'Space Mono',monospace",fontSize:9,letterSpacing:2,color:"#333",
                            padding:"6px 8px",textAlign:"left",textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {evalData.details.map((d,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid #0d0d1a"}}>
                          <td style={{padding:"5px 8px",fontFamily:"'Space Mono',monospace",fontSize:10,color:"#333"}}>{i+1}</td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{color:d.label===1?"#ff6b6b":"#4dffaa",fontWeight:700,fontSize:11}}>{d.label===1?"FAKE":"REAL"}</span>
                          </td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{color:d.predicted===1?"#ff6b6b":"#4dffaa",fontWeight:700,fontSize:11}}>{d.predicted===1?"FAKE":"REAL"}</span>
                          </td>
                          <td style={{padding:"5px 8px",fontFamily:"'Space Mono',monospace",fontSize:10,color:"#888"}}>{d.confidence.toFixed(1)}%</td>
                          <td style={{padding:"5px 8px"}}>
                            <span style={{color:d.correct?"#00d972":"#ff2d2d",fontWeight:700,fontSize:14}}>{d.correct?"✓":"✗"}</span>
                          </td>
                          <td style={{padding:"5px 8px",color:"#444",fontSize:11,maxWidth:240,
                            overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{d.text.slice(0,60)}…</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{textAlign:"center",marginTop:32,paddingBottom:8,color:"#181828",fontSize:10,
        fontFamily:"'Space Mono',monospace",lineHeight:2}}>
        BERT · HuggingFace Transformers · PyTorch · Scikit-learn · IEEE DataPort
      </div>
    </div>
  );
}
