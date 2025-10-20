import { useState, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, CheckCircle, XCircle, Loader2, FileText, X } from 'lucide-react';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

interface FileStatus {
  file: File;
  status: UploadStatus;
  error?: string;
}

export default function AdminUpload() {
  const [selectedFiles, setSelectedFiles] = useState<FileStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newFiles: FileStatus[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error(`${file.name} is geen PDF bestand`);
        continue;
      }

      // Validate file size (max 25MB)
      const maxSize = 25 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`${file.name} is groter dan 25MB`);
        continue;
      }

      newFiles.push({
        file,
        status: 'pending'
      });
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
    
    // Reset input
    event.target.value = '';
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Selecteer eerst bestanden');
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    const authToken = localStorage.getItem('auth_token');
    if (!authToken) {
      toast.error('Niet ingelogd');
      setIsUploading(false);
      return;
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileStatus = selectedFiles[i];
      
      // Skip already successful uploads
      if (fileStatus.status === 'success') {
        successCount++;
        continue;
      }

      // Update status to uploading
      setSelectedFiles(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'uploading' };
        return updated;
      });

      try {
        // Convert file to base64
        const fileBase64 = await fileToBase64(fileStatus.file);

        // Sanitize filename with consistent normalization logic
        const sanitizedFilename = fileStatus.file.name
          .trim()                          // First trim whitespace
          .replace(/\s+/g, '_')            // Replace spaces with underscores
          .replace(/_+/g, '_')             // Consolidate multiple underscores
          .replace(/_+\.pdf$/i, '.pdf');   // Remove trailing underscores before .pdf

        // Upload to backend
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-upload`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              filename: sanitizedFilename,
              fileBase64
            })
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Upload mislukt');
        }

        // Update status to success
        setSelectedFiles(prev => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'success' };
          return updated;
        });
        successCount++;

      } catch (error) {
        console.error(`Error uploading ${fileStatus.file.name}:`, error);
        
        // Update status to error
        setSelectedFiles(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            status: 'error',
            error: error instanceof Error ? error.message : 'Onbekende fout'
          };
          return updated;
        });
        errorCount++;
      }
    }

    setIsUploading(false);

    // Show result toast
    if (successCount === selectedFiles.length) {
      toast.success('Alle PDFs succesvol geüpload!');
    } else if (successCount > 0) {
      toast.warning(`${successCount} van ${selectedFiles.length} PDFs geüpload. ${errorCount} mislukt.`);
    } else {
      toast.error('Geen PDFs geüpload. Alle uploads zijn mislukt.');
    }
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>PDF Upload naar Storage</CardTitle>
            <CardDescription>
              Selecteer PDF bestanden om te uploaden naar de storage bucket. Deze zullen beschikbaar zijn voor bronvermelding.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Input */}
            <div className="space-y-2">
              <label htmlFor="file-upload" className="block text-sm font-medium">
                Selecteer PDF bestanden
              </label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                disabled={isUploading}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Maximaal 25MB per bestand. Alleen PDF bestanden toegestaan.
              </p>
            </div>

            {/* Action Buttons */}
            {selectedFiles.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  onClick={uploadFiles} 
                  disabled={isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploaden...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {selectedFiles.length} bestand{selectedFiles.length !== 1 ? 'en' : ''}
                    </>
                  )}
                </Button>
                <Button 
                  onClick={clearSelection} 
                  disabled={isUploading}
                  variant="outline"
                >
                  <X className="mr-2 h-4 w-4" />
                  Wis selectie
                </Button>
              </div>
            )}

            {/* File List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">
                  Geselecteerde bestanden ({selectedFiles.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedFiles.map((fileStatus, index) => (
                    <div
                      key={`${fileStatus.file.name}-${index}`}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fileStatus.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(fileStatus.file.size)}
                          </p>
                          {fileStatus.error && (
                            <p className="text-xs text-destructive mt-1">
                              {fileStatus.error}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {fileStatus.status === 'pending' && (
                          <>
                            <span className="text-xs text-muted-foreground">Wachtend</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              disabled={isUploading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {fileStatus.status === 'uploading' && (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            <span className="text-xs text-blue-500">Uploaden...</span>
                          </>
                        )}
                        {fileStatus.status === 'success' && (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-xs text-green-500">Geüpload</span>
                          </>
                        )}
                        {fileStatus.status === 'error' && (
                          <>
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive">Fout</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              disabled={isUploading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {selectedFiles.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Geen bestanden geselecteerd
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Klik op "Bladeren" hierboven om PDF bestanden te selecteren
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
