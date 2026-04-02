import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const upload = async (file: File): Promise<string | null> => {
    if (!user) return null;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      return urlData.publicUrl;
    } catch (err) {
      const error = err as Error;
      toast.error('Erro ao enviar arquivo: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading };
}
