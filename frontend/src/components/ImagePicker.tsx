import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload, X, Plus, Link2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { Img, Input, Button, cx } from './ui';

/** Uploads via the backend (Cloudinary, signed server-side). Falls back to pasting a URL when uploads aren't configured. */
export function ImagePicker({ value, onChange, max = 10, folder, single }: { value: { url: string; publicId?: string }[]; onChange: (v: { url: string; publicId?: string }[]) => void; max?: number; folder: string; single?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const next = [...value];
      for (const f of Array.from(files).slice(0, max - value.length)) {
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name} is larger than 5MB`);
          continue;
        }
        const fd = new FormData();
        fd.append('file', f);
        const { data } = await api.post(`/admin/uploads?folder=${folder}`, fd);
        next.push({ url: data.url, publicId: data.publicId });
      }
      onChange(single ? next.slice(-1) : next);
    } catch (e) {
      toast.error(errorMessage(e));
      setShowUrl(true);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }
  function addUrl() {
    try {
      new URL(url);
    } catch {
      return toast.error('Enter a valid image URL');
    }
    onChange(single ? [{ url }] : [...value, { url }]);
    setUrl('');
    setShowUrl(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((img, i) => (
          <div key={img.url + i} className={cx('relative overflow-hidden rounded-xl border border-line', i === 0 && !single ? 'size-36' : 'size-28')}>
            <Img src={img.url} alt={`Image ${i + 1}`} className="size-full" />
            {i === 0 && !single && <span className="absolute bottom-1.5 left-1.5 rounded-md bg-brand-900 px-2 py-0.5 text-[11px] font-semibold text-white">Main Image</span>}
            <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-ink/80 text-white hover:bg-ink"><X size={13} /></button>
            {i > 0 && !single && <button type="button" onClick={() => onChange([img, ...value.filter((_, j) => j !== i)])} className="absolute bottom-1.5 left-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Make main</button>}
          </div>
        ))}
        {value.length < (single ? 1 : max) && (
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="grid size-28 min-w-36 place-items-center rounded-xl border-2 border-dashed border-line bg-[#fcfaf6] px-3 text-center text-xs text-muted hover:border-brand-600/50 disabled:opacity-60">
            <span>
              {value.length ? <Plus className="mx-auto mb-1 text-ink" size={20} /> : <Upload className="mx-auto mb-1 text-ink" size={20} />}
              <span className="block font-semibold text-ink">{busy ? 'Uploading…' : value.length ? 'Add More' : 'Upload Images'}</span>
              JPG, PNG, WebP (Max 5MB)
            </span>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" multiple={!single} hidden onChange={(e) => upload(e.target.files)} />
      {showUrl ? (
        <div className="mt-3 flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… image URL" aria-label="Image URL" />
          <Button type="button" onClick={addUrl}>Add</Button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowUrl(true)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"><Link2 size={13} /> Paste an image URL instead</button>
      )}
    </div>
  );
}
