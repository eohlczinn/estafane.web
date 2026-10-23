import React, {useState} from 'react';
import {Activity, Compass, Gauge, Palette, Trash2} from 'lucide-react';
import {useClosing} from '../../context/ClosingContext.jsx';
import {useExperience} from '../../context/experience.js';
import {appearancePresets, normalizeExperience} from '../../services/experience.js';
import {resolvePerformance} from '../../services/preferences.js';
const Toggle=({label,description,checked,onChange})=><label className="settings-toggle"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/></label>;
export default function ExperienceSettings() {
  const {prefs,setPrefs}=useClosing(),{memory,record,clearMemory}=useExperience();
  const [erase,setErase]=useState(false);
  const set=(key,value)=>setPrefs(old=>({...old,[key]:value}));
  const safe=normalizeExperience(memory,prefs.memoryDays),count=Object.keys(safe.signals).length;
  const favoritePaper=Object.entries(safe.signals).filter(([k])=>k.startsWith('paper:')).sort((a,b)=>b[1].count-a[1].count)[0]?.[0].split(':')[1];
  return <>
    <section className="panel settings-panel experience-presets" id="estilos"><h2><Palette size={22}/>Uma identidade para o seu espaço</h2><p className="muted">Escolha um ponto de partida. Depois ajuste cada detalhe do seu jeito.</p><div className="preset-grid">{Object.entries(appearancePresets).map(([id,p])=><button className={`preset-card preset-${id}`} key={id} onClick={()=>{setPrefs(old=>({...old,...p.prefs}));record('accent',p.prefs.accent);}}><span className="preset-art"><i/><i/><i/></span><strong>{p.label}</strong><small>{p.description}</small></button>)}</div>
      <label>Fundo do espaço<select value={prefs.surface} onChange={e=>set('surface',e.target.value)}><option value="aurora">Aurora · luz suave</option><option value="mesh">Prisma · encontro de cores</option><option value="minimal">Essencial · fundo limpo</option></select></label>
      <label>Intensidade das cores<select value={prefs.colorDepth} onChange={e=>set('colorDepth',e.target.value)}><option value="soft">Discreta</option><option value="balanced">Equilibrada</option><option value="vivid">Vibrante</option></select></label>
      <label>Espaçamento<select value={prefs.density} onChange={e=>set('density',e.target.value)}><option value="comfortable">Confortável</option><option value="compact">Compacto</option></select></label>
      <label>Tamanho do texto<input type="range" min="90" max="120" step="5" value={prefs.fontScale} onChange={e=>set('fontScale',Number(e.target.value))}/><small>{prefs.fontScale}%</small></label>
    </section>
    <section className="panel settings-panel" id="otimizacao"><h2><Gauge size={22}/>Desempenho e otimização</h2><p className="muted">Ajustes de interface. A precisão da leitura e as regras do caixa permanecem as mesmas.</p>
      <label>Modo de desempenho<select value={prefs.performance} onChange={e=>set('performance',e.target.value)}><option value="auto">Automático · conforme o dispositivo</option><option value="eco">Econômico · menos consumo</option><option value="balanced">Equilibrado · efeitos leves</option><option value="quality">Visual completo · todos os efeitos permitidos</option></select></label>
      <div className="performance-status"><Activity size={17}/><span>Em uso: <strong>{resolvePerformance(prefs,navigator)==='eco'?'Econômico':resolvePerformance(prefs,navigator)==='quality'?'Visual completo':'Equilibrado'}</strong></span></div>
      <p className="muted">Automático considera economia de dados e capacidade informada pelo navegador. A preferência de movimento reduzido sempre prevalece.</p>
      <Toggle label="Pausar quando a aba estiver oculta" description="Interrompe animações e verificações periódicas de conexão fora da tela." checked={prefs.pauseWhenHidden} onChange={v=>set('pauseWhenHidden',v)}/>
      <label>Intervalo para verificar a conexão<select value={prefs.healthInterval} onChange={e=>set('healthInterval',Number(e.target.value))}>{[15,30,60,120].map(n=><option key={n} value={n}>A cada {n} segundos</option>)}</select></label>
      <p className="muted">No modo econômico, o intervalo mínimo é de 60 segundos. Páginas de configurações, perfil e relatórios são carregadas quando você as abre.</p>
    </section>
    <section className="panel settings-panel" id="personalizacao"><h2><Compass size={22}/>Preferências e recomendações</h2>
      <Toggle label="Mostrar sugestões para minha rotina" description="Atalhos conforme a etapa do fechamento e suas preferências." checked={prefs.personalRecommendations} onChange={v=>set('personalRecommendations',v)}/>
      <Toggle label="Aprender com minhas escolhas no site" description="Guarda contagens de páginas abertas, cores, papel e estilos de frases. Pausar não apaga a memória existente." checked={prefs.learnUsage} onChange={v=>set('learnUsage',v)}/>
      <label>Prazo da memória de uso<select value={prefs.memoryDays} onChange={e=>set('memoryDays',Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{n} dias</option>)}</select></label>
      <div className="memory-summary"><strong>{count} preferências de uso registradas</strong><p>{favoritePaper?`Papel mais escolhido: ${favoritePaper==='a4'?'A4':favoritePaper+' mm'}.`:'O site ainda não tem um papel favorito para sugerir.'}</p></div>
      <details className="memory-details"><summary>Ver o que está salvo</summary>{Object.entries(safe.signals).map(([key,v])=><div key={key}><code>{key}</code><span>{Math.round(v.count*10)/10} escolhas</span></div>)}{count===0&&<p>Nenhuma contagem salva.</p>}<p>{Object.keys(safe.feedback).length} avaliações de sugestões.</p></details>
      <p className="muted">Memória local deste navegador. Sem rastrear outros sites, sem enviar preferências para terceiros e sem guardar o conteúdo ou os valores dos seus documentos. Apagar a memória também restaura sugestões ocultadas.</p>
      {!erase?<button className="secondary" onClick={()=>setErase(true)}><Trash2 size={16}/>Apagar memória de uso</button>:<div className="erase-confirm"><p>Apagar as contagens e avaliações deste navegador? Preferências visuais e perfis de importação serão mantidos.</p><button className="secondary" onClick={()=>{clearMemory();setErase(false);}}>Apagar memória agora</button><button className="text-button" onClick={()=>setErase(false)}>Cancelar</button></div>}
    </section>
  </>;
}
