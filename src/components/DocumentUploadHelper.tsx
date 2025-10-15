import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const DocumentUploadHelper = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const uploadDocumentsToStorage = async () => {
    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const documents = [
        'RTK_NI-1341_v12-1114.pdf',
        'RTK_NI-1341_v12-1114-2.pdf'
      ];

      const results = await Promise.all(
        documents.map(async (filename) => {
          try {
            // Fetch the local file
            const response = await fetch(`/documents/${filename}`);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${filename}`);
            }

            const blob = await response.blob();
            
            // Create FormData for upload
            const formData = new FormData();
            formData.append('file', blob, filename);
            formData.append('filename', filename);

            // Upload to storage via edge function
            const uploadResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-document`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                },
                body: formData,
              }
            );

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(errorData.error || `Upload failed for ${filename}`);
            }

            const result = await uploadResponse.json();
            console.log(`Successfully uploaded ${filename}:`, result);
            return { success: true, filename };
          } catch (error) {
            console.error(`Error uploading ${filename}:`, error);
            return { success: false, filename, error };
          }
        })
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (failureCount === 0) {
        setUploadStatus('success');
        toast({
          title: "Succesvol!",
          description: `${successCount} PDF${successCount > 1 ? "'s" : ''} succesvol geüpload naar storage.`,
        });
      } else {
        setUploadStatus('error');
        toast({
          title: "Gedeeltelijk gelukt",
          description: `${successCount} van ${results.length} bestanden geüpload. ${failureCount} mislukt.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden bij het uploaden",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        onClick={uploadDocumentsToStorage}
        disabled={isUploading || uploadStatus === 'success'}
        variant={uploadStatus === 'success' ? 'outline' : 'default'}
        size="sm"
        className="shadow-lg"
      >
        {isUploading ? (
          <>
            <Upload className="w-4 h-4 mr-2 animate-pulse" />
            Uploaden...
          </>
        ) : uploadStatus === 'success' ? (
          <>
            <Check className="w-4 h-4 mr-2 text-green-600" />
            Geüpload naar Storage
          </>
        ) : uploadStatus === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            Upload naar Storage
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload PDF's naar Storage
          </>
        )}
      </Button>
    </div>
  );
};