'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Upload,
  FileText,
  File,
  MoreHorizontal,
  Loader2,
  CloudOff,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import {
  getCurricula,
  uploadCurriculum,
  deleteCurriculum,
  ragReembed,
  ragRetrieve,
  getTeachers,
  type Curriculum,
} from '@/lib/api';

function fileTypeLabel(type: string) {
  if (type === 'pdf') return 'PDF';
  if (type === 'word') return 'DOCX';
  return 'DOC';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CurriculaPage() {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // Upload form
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('3rd');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Search / preview
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ content: string; similarity: number; chunkIndex: number }>
  >([]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [c, teachers] = await Promise.all([getCurricula(), getTeachers()]);
      setCurricula(c);
      if (teachers.length > 0) setTeacherId(teachers[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load curricula');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !teacherId) return;
    setUploading(true);
    try {
      await uploadCurriculum(file, {
        title: title || file.name,
        teacherId,
        subject: subject || undefined,
        gradeLevel: gradeLevel || undefined,
      });
      setFile(null);
      setTitle('');
      setSubject('');
      if (fileInput.current) fileInput.current.value = '';
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this curriculum and its indexed chunks?')) return;
    try {
      await deleteCurriculum(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function handleReembed(c: Curriculum) {
    setError(null);
    try {
      const res = await ragReembed(c.id);
      alert(
        `Re-embedded ${res.chunksReembedded} chunk(s) with ${res.model} (${res.dimensions} dims).`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-embed failed');
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await ragRetrieve(searchQuery, { topK: 5 });
      setSearchResults(
        results.map((r) => ({
          content: r.content,
          similarity: r.similarity,
          chunkIndex: r.chunkIndex,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <AppShell>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Curricula</h1>
        <p className="text-sm text-muted-foreground">
          Upload documents. They are parsed, chunked, and embedded for retrieval.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <CloudOff className="h-5 w-5 text-destructive" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Curriculum</CardTitle>
          <CardDescription>PDF or Word documents up to 50MB.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              onClick={() => fileInput.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted'
              }`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                {file ? file.name : 'Drop a file here or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground">PDF, DOCX</p>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-3">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3rd Grade Math - Unit 1" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Math" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Grade level</label>
                <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={!file || uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                  {uploading ? 'Processing…' : 'Upload & Index'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Search Indexed Content
          </CardTitle>
          <CardDescription>
            Vector similarity search across all indexed chunks (preview what RAG will retrieve).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. adding two-digit numbers with regrouping"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
              Search
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((r, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="text-[10px]">
                      Chunk {r.chunkIndex + 1}
                    </Badge>
                    <Badge variant="info" className="text-[10px]">
                      {(r.similarity * 100).toFixed(0)}% similar
                    </Badge>
                  </div>
                  <p className="line-clamp-3 text-sm text-foreground/80">{r.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Indexed Curricula</CardTitle>
          <CardDescription>{curricula.length} document(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : curricula.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No curricula yet. Upload a document above to get started.
            </p>
          ) : (
            curricula.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  {c.fileType === 'pdf' ? (
                    <FileText className="h-5 w-5 text-primary" />
                  ) : (
                    <File className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fileTypeLabel(c.fileType)} · {c.fileName} · {c.chunkCount} chunks ·{' '}
                    {formatDate(c.createdAt)}
                    {c.subject && ` · ${c.subject}`}
                  </p>
                </div>
                <Badge variant="success" className="text-[10px]">
                  processed
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Re-embed with current model"
                    onClick={() => handleReembed(c)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
