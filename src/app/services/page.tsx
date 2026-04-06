'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import Pagination from '@/components/ui/Pagination';
import { Server, Package, Mail, Wifi, Copy, RefreshCw, XCircle, Plus, Globe } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface ServiceConfig { hostname?: string; ipAddress?: string; region?: string; }
interface Subscription {
  id: string; status: string; renewsAt?: string;
  product: { name: string; category: string };
  plan: { name: string; price: number; limits: Record<string,string> };
  serviceConfig?: ServiceConfig;
}

const catIcon: Record<string,React.ReactNode> = { VPS:<Server size={20}/>, DOCKER:<Package size={20}/>, EMAIL:<Mail size={20}/> };
const catColor: Record<string,string> = { VPS:'var(--vps-color)', DOCKER:'var(--docker-color)', EMAIL:'var(--email-color)' };
const LIMIT = 5;

export default function ServicesPage() {
  const [user, setUser] = useState<User|null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string|null>(null);
  const [copied, setCopied] = useState<string|null>(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, []);

  useEffect(() => {
    setLoading(true);
    const statusQ = filter !== 'all' ? `&status=${filter}` : '';
    fetch(`/api/subscriptions?limit=${LIMIT}&page=${page}${statusQ}`)
      .then(r=>r.json()).then(d=>{
        setSubscriptions(d.data?.subscriptions||[]);
        setTotal(d.data?.meta?.total||0);
        setLoading(false);
      });
  }, [filter, page]);

  async function handleCancel(id: string) {
    if (!confirm('Cancel this service?')) return;
    setCancelling(id);
    await fetch(`/api/subscriptions/${id}`,{method:'DELETE'});
    setSubscriptions(s=>s.map(x=>x.id===id?{...x,status:'CANCELLED'}:x));
    setCancelling(null);
  }

  function copyText(text:string, key:string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(()=>setCopied(null),2000);
  }

  const totalPages = Math.ceil(total/LIMIT);

  return (
    <div className="page-shell">
      <DashboardSidebar user={user}/>
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Services</h1>
            <p className="page-header-sub">Manage your active subscriptions</p>
          </div>
          <Link href="/products" className="btn btn-primary btn-sm"><Plus size={15}/> Add Service</Link>
        </div>
        <div className="page-content">
          <div className="filter-bar">
            {['all','active','suspended','cancelled'].map(f=>(
              <button key={f} onClick={()=>{setFilter(f);setPage(1);}} className={`btn btn-sm${filter===f?' btn-primary':' btn-secondary'}`} style={{textTransform:'capitalize'}}>{f}</button>
            ))}
          </div>

          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:64}}><span className="spinner" style={{width:32,height:32}}/></div>
          ) : subscriptions.length===0 ? (
            <div className="empty-state">
              <div style={{fontSize:48,marginBottom:16}}>🔌</div>
              <h3 style={{fontFamily:'var(--font-display)',marginBottom:8}}>No services found</h3>
              <Link href="/products" className="btn btn-primary" style={{display:'inline-flex',marginTop:8}}><Plus size={16}/> Browse Products</Link>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {subscriptions.map(sub=>{
                const color=catColor[sub.product.category]||'var(--accent)';
                return (
                  <div key={sub.id} className="service-card" style={{opacity:sub.status==='CANCELLED'?0.6:1}}>
                    <div className="service-card-header">
                      <div className="stat-card-icon" style={{width:48,height:48,borderRadius:12,background:`${color}15`,color,flexShrink:0}}>{catIcon[sub.product.category]}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:2,flexWrap:'wrap'}}>
                          <h3 style={{fontWeight:600,fontSize:16}}>{sub.product.name}</h3>
                          <span className={`badge badge-${sub.product.category.toLowerCase()}`}>{sub.product.category}</span>
                          <span className={`badge badge-${sub.status.toLowerCase()}`}>{sub.status}</span>
                        </div>
                        <div style={{fontSize:13,color:'var(--text-muted)'}}>
                          {sub.plan.name} · ${sub.plan.price}/mo
                          {sub.renewsAt && ` · Renews ${new Date(sub.renewsAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      {sub.status==='ACTIVE'&&(
                        <button onClick={()=>handleCancel(sub.id)} disabled={cancelling===sub.id} className="btn btn-sm btn-danger">
                          {cancelling===sub.id?<span className="spinner" style={{width:14,height:14}}/>:<><XCircle size={14}/> Cancel</>}
                        </button>
                      )}
                    </div>
                    {sub.serviceConfig&&(
                      <div className="service-card-config">
                        {sub.serviceConfig.hostname&&(
                          <div>
                            <div className="config-label">Hostname</div>
                            <div className="config-val">
                              <code className="config-code">{sub.serviceConfig.hostname}</code>
                              <button className="copy-btn" onClick={()=>copyText(sub.serviceConfig!.hostname!,`h-${sub.id}`)}>
                                {copied===`h-${sub.id}`?<RefreshCw size={12} color="var(--green)"/>:<Copy size={12}/>}
                              </button>
                            </div>
                          </div>
                        )}
                        {sub.serviceConfig.ipAddress&&(
                          <div>
                            <div className="config-label">IP Address</div>
                            <div className="config-val">
                              <code className="config-code">{sub.serviceConfig.ipAddress}</code>
                              <button className="copy-btn" onClick={()=>copyText(sub.serviceConfig!.ipAddress!,`ip-${sub.id}`)}>
                                {copied===`ip-${sub.id}`?<RefreshCw size={12} color="var(--green)"/>:<Copy size={12}/>}
                              </button>
                            </div>
                          </div>
                        )}
                        {sub.serviceConfig.region&&(
                          <div>
                            <div className="config-label">Region</div>
                            <div className="config-val" style={{fontSize:12,color:'var(--text-secondary)'}}><Globe size={12}/> {sub.serviceConfig.region}</div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="service-card-limits">
                      {Object.entries(sub.plan.limits).map(([k,v])=>(
                        <div key={k} className="limit-chip">
                          <div className="limit-chip-label">{k}</div>
                          <div className="limit-chip-val" style={{color}}>{String(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage}/>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
