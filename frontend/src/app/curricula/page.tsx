import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const curricula = [
  {
    id: '1',
    title: '3rd Grade Math - Unit 1: Addition & Subtraction',
    subject: 'Math',
    fileType: 'PDF',
    fileName: 'math-unit1.pdf',
    chunks: 24,
    uploaded: 'Oct 1, 2025',
    status: 'processed',
  },
  {
    id: '2',
    title: '3rd Grade Math - Unit 2: Multiplication',
    subject: 'Math',
    fileType: 'PDF',
    fileName: 'math-unit2.pdf',
    chunks: 18,
    uploaded: 'Oct 5, 2025',
    status: 'processed',
  },
  {
    id: '3',
    title: '3rd Grade Math - Unit 3: Division',
    subject: 'Math',
    fileType: 'PDF',
    fileName: 'math-unit3.pdf',
    chunks: 15,
    uploaded: 'Oct 10, 2025',
    status: 'processing',
  },
  {
    id: '4',
    title: '3rd Grade Reading - Fiction Unit',
    subject: 'Reading',
    fileType: 'DOCX',
    fileName: 'reading-fiction.docx',
    chunks: 32,
    uploaded: 'Oct 2, 2025',
    status: 'processed',
  },
  {
    id: '5',
    title: '3rd Grade Science - Life Cycles',
    subject: 'Science',
    fileType: 'GDOC',
    fileName: 'science-lifecycles',
    chunks: 0,
    uploaded: 'Oct 16, 2025',
    status: 'uploading',
  },
];

const statusVariant: Record<
  string,
  'success' | 'warning' | 'info' | 'destructive'
> = {
  processed: 'success',
  processing: 'warning',
  uploading: 'info',
  error: 'destructive',
};

const fileIcon = (type: string) => {
  switch (type) {
    case 'PDF':
      return FileText;
    case 'DOCX':
      return FileSpreadsheet;
    default:
      return File;
  }
};

export default function CurriculaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Curricula</h1>
          <p className="text-sm text-muted-foreground">
            5 curricula · 89 chunks indexed
          </p>
        </div>
        <Button>
          <Upload />
          Upload Curriculum
        </Button>
      </div>

      {/* Upload Zone */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-medium">
            Drag &amp; drop files here, or click to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Supports PDF, Word (.docx), Google Docs · Sync from Google
            Classroom or Canvas
          </p>
        </CardContent>
      </Card>

      {/* Curricula List */}
      <div className="space-y-3">
        {curricula.map((c) => {
          const Icon = fileIcon(c.fileType);
          return (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-lg',
                      c.fileType === 'PDF' && 'bg-red-50',
                      c.fileType === 'DOCX' && 'bg-blue-50',
                      c.fileType === 'GDOC' && 'bg-green-50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        c.fileType === 'PDF' && 'text-red-600',
                        c.fileType === 'DOCX' && 'text-blue-600',
                        c.fileType === 'GDOC' && 'text-green-600'
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.fileType} · {c.chunks} chunks · {c.uploaded}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={statusVariant[c.status]}
                    className="capitalize"
                  >
                    {c.status}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
