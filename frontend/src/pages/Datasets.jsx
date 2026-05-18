import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { UploadSimple, FileCsv, Trash, ArrowRight, Sparkle, CheckCircle, Clock, Warning, X } from "@phosphor-icons/react";
import { toast } from "sonner";

const STATUS_LABEL = {
  uploaded: { label: "Awaiting analysis", cls: "bg-ink-100 text-ink-400 border-ink-200" },
  analyzing: { label: "Analyzing…", cls: "bg-info/10 text-info border-info/30" },
  ready: { label: "Ready", cls: "bg-success/10 text-success border-success/30" },
  error: { label: "Error", cls: "bg-danger/10 text-danger border-danger/30" },
};

export default function Datasets() {
  const { activeWorkspaceId } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    if (!activeWorkspaceId) return;
    const { data } = await api.get("/datasets", { params: { workspace_id: activeWorkspaceId } });
    setDatasets(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeWorkspaceId]);

  const upload = async (files) => {
    if (!files?.length || !activeWorkspaceId) return;
    setUploading(true);
    const uploaded = [];
    for (const f of files) {
      const fd = new FormData();
      fd.append("workspace_id", activeWorkspaceId);
      fd.append("file", f);
      try {
        const { data } = await api.post("/datasets/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        uploaded.push(data);
        toast.success(`${f.name} uploaded`);
      } catch (e) {
        toast.error(`${f.name}: ${e.response?.data?.detail || "upload failed"}`);
      }
    }
    setUploading(false);
    await load();
    // Auto-analyze each uploaded dataset
    for (const d of uploaded) {
      setAnalyzingId(d.dataset_id);
      try {
        await api.post(`/datasets/${d.dataset_id}/analyze`);
        toast.success(`${d.filename}: analyzed`);
      } catch (e) {
        toast.error(`${d.filename}: analyze failed`);
      }
      setAnalyzingId(null);
    }
    await load();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    upload([...e.dataTransfer.files]);
  };

  const del = async (id) => {
    await api.delete(`/datasets/${id}`);
    toast.success("Dataset removed");
    load();
  };

  return (
    <div className="space-y-6" data-testid="datasets-page">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
          dragOver ? "border-ink bg-ink-50" : "border-ink-200 hover:border-ink-300 bg-white"
        }`}
        data-testid="upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.xlsm,.txt"
          multiple
          className="hidden"
          onChange={(e) => upload([...e.target.files])}
          data-testid="file-input"
        />
        <div className="w-12 h-12 rounded-xl bg-ink text-white mx-auto flex items-center justify-center">
          <UploadSimple size={20} weight="bold" />
        </div>
        <h3 className="font-display font-bold text-xl mt-4 text-ink">
          {uploading ? "Uploading…" : "Drop your campaign exports"}
        </h3>
        <p className="text-sm text-ink-400 mt-1.5 max-w-md mx-auto">
          CSV or XLSX exports from Meta, Google Ads, GA4, LinkedIn, Twitter / X, YouTube.
          Each file becomes its own AI-analyzed dashboard.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-400">
          <kbd className="px-2 py-0.5 rounded bg-ink-50 border border-ink-200 font-num">.csv</kbd>
          <kbd className="px-2 py-0.5 rounded bg-ink-50 border border-ink-200 font-num">.xlsx</kbd>
          <span>· up to 200MB each</span>
        </div>
      </div>

      {/* Dataset list */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Data sources</div>
            <h2 className="font-display font-bold text-xl mt-0.5">Uploaded lenses</h2>
          </div>
          <span className="text-xs font-num text-ink-400">{datasets.length} total</span>
        </div>

        {datasets.length === 0 ? (
          <div className="border border-dashed border-ink-200 rounded-xl p-10 text-center">
            <FileCsv size={28} className="mx-auto text-ink-300 mb-2" />
            <div className="text-sm text-ink-400">
              No datasets yet. Drop a file above to get started.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((d) => {
              const sta = STATUS_LABEL[d.status] || STATUS_LABEL.uploaded;
              const isAnalyzing = analyzingId === d.dataset_id || d.status === "analyzing";
              return (
                <div
                  key={d.dataset_id}
                  className="bg-white border border-ink-200 rounded-xl p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all group"
                  data-testid={`dataset-${d.dataset_id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg bg-ink-100 text-ink flex items-center justify-center">
                      <FileCsv size={18} weight="fill" />
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-medium border ${sta.cls}`}>
                      {d.status === "ready" && <CheckCircle size={10} weight="fill" />}
                      {d.status === "analyzing" && <Clock size={10} weight="fill" />}
                      {d.status === "error" && <Warning size={10} weight="fill" />}
                      {sta.label}
                    </span>
                  </div>
                  <h4 className="font-display font-bold text-ink mt-3 truncate" title={d.filename}>
                    {d.filename}
                  </h4>
                  <div className="mt-1.5 text-xs text-ink-400 space-y-0.5">
                    {d.platform && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-info" />
                        {d.platform.replace("_", " ")}
                      </div>
                    )}
                    {d.row_count && <div className="font-num">{d.row_count.toLocaleString()} rows · {(d.size / 1024).toFixed(1)} KB</div>}
                    <div className="font-num text-ink-300">{new Date(d.created_at).toLocaleString()}</div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {d.status === "ready" ? (
                      <Button
                        onClick={() => navigate(`/datasets/${d.dataset_id}`)}
                        className="flex-1 bg-ink text-white hover:bg-ink-500 h-9"
                        data-testid={`open-dataset-${d.dataset_id}`}
                      >
                        Open <ArrowRight size={12} className="ml-1.5" />
                      </Button>
                    ) : d.status === "uploaded" ? (
                      <Button
                        onClick={async () => {
                          setAnalyzingId(d.dataset_id);
                          try {
                            await api.post(`/datasets/${d.dataset_id}/analyze`);
                            toast.success("Analyzed");
                          } catch (e) {
                            toast.error("Analyze failed");
                          }
                          setAnalyzingId(null);
                          load();
                        }}
                        disabled={isAnalyzing}
                        className="flex-1 bg-ink text-white hover:bg-ink-500 h-9"
                        data-testid={`analyze-${d.dataset_id}`}
                      >
                        <Sparkle size={12} weight="fill" className="mr-1.5" />
                        {isAnalyzing ? "Analyzing…" : "Analyze"}
                      </Button>
                    ) : (
                      <Button disabled variant="outline" className="flex-1 h-9">
                        {sta.label}
                      </Button>
                    )}
                    <button
                      onClick={() => del(d.dataset_id)}
                      className="w-9 h-9 rounded-md border border-ink-200 text-ink-400 hover:text-danger hover:border-danger/40 transition-all inline-flex items-center justify-center"
                      data-testid={`delete-${d.dataset_id}`}
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
