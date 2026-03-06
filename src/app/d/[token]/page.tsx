"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { Upload, CheckCircle2, AlertCircle, FileIcon, X, Loader2 } from "lucide-react";

type RequestStatus = "loading" | "pending" | "completed" | "expired" | "error";

interface RequestInfo {
  contactName: string;
  message: string | null;
  taskTitle: string | null;
  expiresAt: string | null;
}

export default function DocumentUploadPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<RequestStatus>("loading");
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/document-requests/public/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 410) {
            setStatus("expired");
          } else {
            setStatus("error");
            setError(data.error ?? "Noe gikk galt");
          }
          return;
        }
        if (data.status === "completed") {
          setStatus("completed");
        } else {
          setStatus("pending");
        }
        setInfo(data);
      })
      .catch(() => {
        setStatus("error");
        setError("Kunne ikke laste forespørsel");
      });
  }, [token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      if (selected.length > 0) setFiles((prev) => [...prev, ...selected]);
      e.target.value = "";
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0 || !token) return;
    setUploading(true);
    setError(null);

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch(`/api/document-requests/public/${token}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Opplasting feilet");
        setUploading(false);
        return;
      }

      setUploadDone(true);
      setUploading(false);
    } catch {
      setError("Opplasting feilet. Vennligst prøv igjen.");
      setUploading(false);
    }
  }, [files, token]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Image
              src="/logo-icon-no-bg.png"
              alt="Revizo"
              width={24}
              height={24}
            />
            <span className="text-[15px] font-semibold text-[#171717] tracking-tight">
              Revizo
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-lg p-8">
          {status === "loading" && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#737373]" />
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-8">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#171717] mb-2">
                Noe gikk galt
              </h2>
              <p className="text-sm text-[#737373]">{error}</p>
            </div>
          )}

          {status === "expired" && (
            <div className="text-center py-8">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#171717] mb-2">
                Lenken har utløpt
              </h2>
              <p className="text-sm text-[#737373]">
                Denne forespørselen er ikke lenger gyldig. Ta kontakt med din
                regnskapsfører for en ny lenke.
              </p>
            </div>
          )}

          {status === "completed" && !uploadDone && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-[#38c96c] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#171717] mb-2">
                Allerede levert
              </h2>
              <p className="text-sm text-[#737373]">
                Dokumentasjon for denne forespørselen er allerede lastet opp.
              </p>
            </div>
          )}

          {uploadDone && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-[#38c96c] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[#171717] mb-2">
                Takk!
              </h2>
              <p className="text-sm text-[#737373]">
                Dokumentasjonen er mottatt. Du kan lukke denne siden.
              </p>
            </div>
          )}

          {status === "pending" && !uploadDone && info && (
            <>
              <h2 className="text-lg font-semibold text-[#171717] mb-1 tracking-tight">
                Last opp dokumentasjon
              </h2>
              <p className="text-sm text-[#737373] mb-6">
                Hei {info.contactName}, du har mottatt en forespørsel om å
                laste opp dokumentasjon.
              </p>

              {info.message && (
                <div className="bg-[#f5f5f5] rounded-md p-4 mb-6 border-l-[3px] border-[#38c96c]">
                  <p className="text-sm text-[#171717] leading-relaxed">
                    {info.message}
                  </p>
                </div>
              )}

              {info.taskTitle && (
                <div className="bg-[#f5f5f5] rounded-md px-4 py-3 mb-6">
                  <span className="text-[11px] text-[#737373] uppercase tracking-wider font-medium">
                    Gjelder
                  </span>
                  <p className="text-sm text-[#171717] font-medium mt-0.5">
                    {info.taskTitle}
                  </p>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#e5e5e5] rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-[#a3a3a3] hover:bg-[#fafafa] mb-4"
              >
                <Upload className="h-8 w-8 text-[#a3a3a3] mx-auto mb-3" />
                <p className="text-sm text-[#171717] font-medium mb-1">
                  Dra og slipp filer her
                </p>
                <p className="text-xs text-[#737373]">
                  eller klikk for å velge filer
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2 mb-6">
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 bg-[#f5f5f5] rounded-md"
                    >
                      <FileIcon className="h-4 w-4 text-[#737373] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#171717] truncate">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-[#737373]">
                          {formatSize(file.size)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(i);
                        }}
                        className="p-1 rounded hover:bg-[#e5e5e5] transition-colors"
                      >
                        <X className="h-3.5 w-3.5 text-[#737373]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
                className="w-full py-2.5 px-4 bg-[#171717] text-white text-sm font-medium rounded-md transition-colors hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Laster opp...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Last opp {files.length > 0 ? `(${files.length} fil${files.length > 1 ? "er" : ""})` : ""}
                  </>
                )}
              </button>

              {info.expiresAt && (
                <p className="text-[11px] text-[#a3a3a3] text-center mt-4">
                  Lenken utløper{" "}
                  {new Date(info.expiresAt).toLocaleDateString("nb-NO", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </>
          )}
        </div>

        <p className="text-[11px] text-[#a3a3a3] text-center mt-6">
          Drevet av Revizo — sikker dokumenthåndtering
        </p>
      </div>
    </div>
  );
}
