'use client';
import ImageField from './ImageField';

export interface SeoValues { metaTitle: string; metaDescription: string; metaKeywords?: string; ogImageUrl: string }

function Counter({ n, ideal }: { n: number; ideal: number }) {
  return <span style={{ fontSize: 11, color: n > ideal ? 'var(--amber)' : 'var(--text-muted)' }}>{n}/{ideal}</span>;
}

/** Meta title / description / (keywords) / share image, with a Google-style preview. */
export default function SeoFields({
  values, onChange, fallbackTitle, fallbackDescription, url, showKeywords,
}: {
  values: SeoValues; onChange: (v: SeoValues) => void;
  fallbackTitle: string; fallbackDescription: string; url: string; showKeywords?: boolean;
}) {
  const set = <K extends keyof SeoValues>(k: K, v: SeoValues[K]) => onChange({ ...values, [k]: v });
  const title = values.metaTitle || fallbackTitle;
  const desc = values.metaDescription || fallbackDescription;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><label className="label">Meta title</label><Counter n={values.metaTitle.length} ideal={60} /></div>
        <input className="input" value={values.metaTitle} onChange={e => set('metaTitle', e.target.value)} maxLength={255} placeholder={fallbackTitle || 'Defaults to the title'} style={{ fontSize: 13 }} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><label className="label">Meta description</label><Counter n={values.metaDescription.length} ideal={160} /></div>
        <textarea className="input" rows={2} value={values.metaDescription} onChange={e => set('metaDescription', e.target.value)} maxLength={320} placeholder="Shown under the title in search results (aim for ≤160 characters)" style={{ fontSize: 13, resize: 'vertical' }} />
      </div>
      {showKeywords && (
        <div>
          <label className="label">Meta keywords (comma-separated, optional)</label>
          <input className="input" value={values.metaKeywords || ''} onChange={e => set('metaKeywords', e.target.value)} maxLength={255} placeholder="cloud vps, docker hosting, india" style={{ fontSize: 13 }} />
        </div>
      )}
      <ImageField label="Share image (Open Graph / Twitter)" value={values.ogImageUrl} onChange={v => set('ogImageUrl', v)} hint="Recommended 1200×630. Used for link previews on social media and chat apps." />
      <div style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', color: '#202124', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ fontSize: 12, color: '#4d5156', wordBreak: 'break-all' }}>{url}</div>
        <div style={{ fontSize: 18, color: '#1a0dab', lineHeight: 1.3 }}>{title.length > 60 ? `${title.slice(0, 59)}…` : title || 'Page title'}</div>
        <div style={{ fontSize: 13, color: '#4d5156', lineHeight: 1.45 }}>{desc.length > 160 ? `${desc.slice(0, 159)}…` : desc || 'Page description'}</div>
      </div>
    </div>
  );
}
