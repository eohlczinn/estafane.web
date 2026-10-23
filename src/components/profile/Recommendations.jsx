import React from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpRight, Compass, ThumbsUp, X} from 'lucide-react';
import {useExperience} from '../../context/experience.js';
export default function Recommendations() {
  const {suggestions,feedback,memory}=useExperience();
  if(!suggestions.length)return null;
  return <section className="recommendations" aria-label="Sugestões para sua rotina">
    <div className="section-intro"><div><span className="eyebrow"><Compass size={14}/> DO SEU JEITO</span><h2>Seu próximo passo, mais fácil.</h2><p>Sugestões a partir desta sessão e das suas escolhas no site.</p></div><Link to="/configuracoes#personalizacao">Controlar personalização <ArrowUpRight size={16}/></Link></div>
    <div className="recommendation-grid">{suggestions.map((s,i)=><article className={`recommendation-card tone-${i}`} key={s.id}>
      <div className="recommendation-top"><span>0{i+1} · PARA SUA ROTINA</span><button className="icon-btn" aria-label={`Ocultar sugestão: ${s.title}`} onClick={()=>feedback(s.id,'hide')}><X size={16}/></button></div>
      <Link to={s.to} className="recommendation-link"><h3>{s.title}</h3><p>{s.description}</p><span>Explorar <ArrowUpRight size={17}/></span></Link>
      <details><summary>Por que estou vendo isso?</summary><p>{s.reason}</p></details>
      <button className="recommendation-feedback" aria-pressed={memory.feedback[s.id]?.value==='useful'} onClick={()=>feedback(s.id,'useful')}><ThumbsUp size={14}/>{memory.feedback[s.id]?.value==='useful'?'Preferência registrada':'Isso é útil para mim'}</button>
    </article>)}</div>
  </section>;
}
