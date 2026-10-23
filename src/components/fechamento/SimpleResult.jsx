import React from 'react';
import {CheckCheck, MessageSquareText, ArrowRight} from 'lucide-react';
import {Link} from 'react-router-dom';
import {useClosing} from '../../context/ClosingContext.jsx';
import {explainClosing} from '../../../shared/closingInsights.js';
import {formatMoney} from '../../../shared/money.js';
export default function SimpleResult() {
  const {closing,prefs}=useClosing();
  if(!prefs.simpleResult)return null;
  const info=explainClosing(closing);
  return <section className={`simple-result ${info.provisional?'provisional':''}`} aria-label="Resultado em palavras simples">
    <div className="simple-result-icon"><MessageSquareText size={27}/></div>
    <div><span className="eyebrow">EM POUCAS PALAVRAS{info.provisional?' · PROVISÓRIO':''}</span><h2>{info.headline}</h2><p>{info.explanation}</p>
      {info.cancellation&&<p className="simple-result-note"><CheckCheck size={16}/>{info.cancellation}</p>}
      <details><summary>Como o sistema chegou a esse valor?</summary><ol>{info.steps.map(s=><li key={s.key}><span>{s.sign>0?'+':'−'} {s.label}</span><strong>{formatMoney(s.value)}</strong></li>)}</ol></details>
      <div className="simple-next">{info.next} {closing.confirmed&&<Link to="/imprimir">Abrir impressão <ArrowRight size={15}/></Link>}</div>
    </div>
  </section>;
}
