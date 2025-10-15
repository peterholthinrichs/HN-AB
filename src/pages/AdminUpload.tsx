import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PDFS_TO_UPLOAD = [
  'Oldham_MX43_NL.pdf',
  'RTK_NI-1341_v12-1114-2.pdf',
  'RTK_NI-1341_v12-1114-3.pdf',
  'RTK_NI-1341_v12-1114.pdf',
  'RTK_React30-edc_v10-0217.pdf',
  'RTK_Repos_v10-0217-02.pdf',
  'RTK_St6151_v20-011.pdf',
  'WITT_BR-NWT_07-23.pdf',
  'WITT_NGX_07-23.pdf',
  'Wijbenga_lmt-niveauschakelaars_v10-0918.pdf',
];

type UploadStatus = {
  [key: string]: 'pending' | 'uploading' | 'success' | 'error';
};

export default function AdminUpload() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>(
    PDFS_TO_UPLOAD.reduce((acc, pdf) => ({ ...acc, [pdf]: 'pending' }), {})
  );
  const [isUploading, setIsUploading] = useState(false);

  const uploadPdfs = async () => {
    setIsUploading(true);
    
    for (const filename of PDFS_TO_UPLOAD) {
      setUploadStatus(prev => ({ ...prev, [filename]: 'uploading' }));
      
      try {
        // Fetch PDF from public folder
        const response = await fetch(`/documents/${filename}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${filename}`);
        }
        
        const blob = await response.blob();
        
        // Upload to storage
        const { error } = await supabase.storage
          .from('documents')
          .upload(filename, blob, {
            contentType: 'application/pdf',
            upsert: true
          });
        
        if (error) throw error;
        
        setUploadStatus(prev => ({ ...prev, [filename]: 'success' }));
      } catch (error) {
        console.error(`Error uploading ${filename}:`, error);
        setUploadStatus(prev => ({ ...prev, [filename]: 'error' }));
      }
    }
    
    setIsUploading(false);
    
    const successCount = Object.values(uploadStatus).filter(s => s === 'success').length;
    if (successCount === PDFS_TO_UPLOAD.length) {
      toast.success('Alle PDFs succesvol geüpload!');
    } else {
      toast.error('Sommige PDFs konden niet worden geüpload');
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>PDF Upload naar Storage</CardTitle>
            <CardDescription>
              Upload alle PDFs van public/documents/ naar de storage bucket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={uploadPdfs} 
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploaden...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Alle PDFs
                </>
              )}
            </Button>

            <div className="space-y-2">
              {PDFS_TO_UPLOAD.map((filename) => (
                <div
                  key={filename}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span className="text-sm font-mono">{filename}</span>
                  <div className="flex items-center gap-2">
                    {uploadStatus[filename] === 'pending' && (
                      <span className="text-xs text-muted-foreground">Wachtend</span>
                    )}
                    {uploadStatus[filename] === 'uploading' && (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-xs text-blue-500">Uploaden...</span>
                      </>
                    )}
                    {uploadStatus[filename] === 'success' && (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-500">Geüpload</span>
                      </>
                    )}
                    {uploadStatus[filename] === 'error' && (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-red-500">Fout</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
