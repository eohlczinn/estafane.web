import {it,expect} from 'vitest';
import {addSignal,emptyExperience,experienceKey,normalizeExperience,readExperience,recommendations} from '../src/services/experience.js';
import {defaultPreferences,normalizePreferences,resolvePerformance} from '../src/services/preferences.js';
const now=Date.UTC(2026,9,23),context={prefs:defaultPreferences};
it('memória aceita apenas contagens conhecidas, sem conteúdo financeiro ou nomes de arquivos',()=>{
  let m=addSignal(emptyExperience(),'route','/imprimir',now);
  m=addSignal(m,'document','caixa-privado.pdf',now);m=addSignal(m,'cash',89540,now);
  m=addSignal(m,'constructor','x',now);m=addSignal(m,'route','https://outro.site',now);
  expect(Object.keys(m.signals)).toEqual(['route:/imprimir']);
  expect(JSON.stringify(m)).not.toContain('privado');expect(JSON.stringify(m)).not.toContain('89540');
  expect(readExperience({getItem:()=>'{'})).toEqual(emptyExperience());
  expect(normalizeExperience({version:1,signals:{'constructor:x':{count:1,at:now}}},30,now)).toEqual(emptyExperience());
});
it('preferências antigas expiram, contagens decaem e novos eventos são limitados',()=>{
  const m=addSignal(emptyExperience(),'paper','80',now-31*86400000);
  expect(normalizeExperience(m,30,now).signals).toEqual({});
  const recent=addSignal(emptyExperience(),'paper','80',now-14*86400000);
  expect(addSignal(recent,'paper','80',now).signals['paper:80'].count).toBe(1.5);
  expect(normalizeExperience({version:1,signals:{'paper:80':{count:1e9,at:now}}},30,now).signals['paper:80'].count).toBe(1000);
});
it('recomendações usam contexto, justificativa e feedback; desativar remove todas',()=>{
  const m=emptyExperience();
  expect(recommendations(m,context,now)[0].id).toBe('import');
  const reviewed={...context,hasDocument:true,pending:3};
  expect(recommendations(m,reviewed,now)[0]).toMatchObject({id:'review',to:'/resultado'});
  expect(recommendations(m,{...reviewed,confirmed:true},now)[0].id).toBe('print');
  m.feedback.review={value:'hide',at:now};expect(recommendations(m,reviewed,now).some(r=>r.id==='review')).toBe(false);
  expect(recommendations(m,{prefs:{...defaultPreferences,personalRecommendations:false}},now)).toEqual([]);
  expect(recommendations(m,context,now).every(r=>r.reason && r.to.startsWith('/'))).toBe(true);
});
it('repetir escolhas muda recomendações sem inventar hábitos',()=>{
  let m=emptyExperience();for(let i=0;i<3;i++)m=addSignal(m,'quotes','faith',now);
  expect(recommendations(m,context,now).some(r=>r.id==='faith')).toBe(true);
  expect(recommendations(emptyExperience(),context,now).some(r=>r.id==='faith')).toBe(false);
  for(let i=0;i<2;i++){m=addSignal(m,'accent','coral',now);m=addSignal(m,'paper','80',now);}
  const personalized=recommendations(m,context,now);
  expect(personalized.find(r=>r.id==='effects').description).toContain('coral');
  expect(personalized.find(r=>r.id==='layout').description).toContain('80 mm');
});
it('normaliza configurações novas e resolve economia de dados e capacidade limitada',()=>{
  expect(normalizePreferences({performance:'invalido',fontScale:999,healthInterval:1,memoryDays:-1,surface:'javascript:'})).toMatchObject({performance:'auto',fontScale:120,healthInterval:15,memoryDays:7,surface:'aurora'});
  expect(resolvePerformance(defaultPreferences,{connection:{saveData:true}})).toBe('eco');
  expect(resolvePerformance(defaultPreferences,{deviceMemory:2})).toBe('eco');
  expect(resolvePerformance(defaultPreferences,{})).toBe('balanced');
  expect(resolvePerformance({...defaultPreferences,performance:'quality'},{deviceMemory:2})).toBe('quality');
});
