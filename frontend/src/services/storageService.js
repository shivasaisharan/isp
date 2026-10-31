import supabase, { isSupabaseConfigured } from '../lib/supabaseClient';

export const BUCKETS = {
  RESUMES: 'candidate-resumes',
  AUDIO: 'interview-audio',
  REPORTS: 'assessment-reports',
  ORG_ASSETS: 'organization-assets',
};

export const storageService = {
  /**
   * Upload candidate resume to private bucket
   */
  async uploadResume(file, candidateId, resumeId) {
    if (!isSupabaseConfigured) return null;
    const path = `${candidateId}/${resumeId || Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await supabase.storage
      .from(BUCKETS.RESUMES)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
    if (error) throw error;
    return { path, ...data };
  },

  /**
   * Generate temporary signed URL for viewing private resume
   */
  async getResumeSignedUrl(path, expiresIn = 3600) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.storage
      .from(BUCKETS.RESUMES)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Upload interview audio recording
   */
  async uploadInterviewAudio(audioBlob, candidateId, interviewId, audioId = 'recording') {
    if (!isSupabaseConfigured) return null;
    const path = `${candidateId}/${interviewId}/${audioId}.webm`;
    const { data, error } = await supabase.storage
      .from(BUCKETS.AUDIO)
      .upload(path, audioBlob, {
        contentType: 'audio/webm',
        cacheControl: '3600',
        upsert: true,
      });
    if (error) throw error;
    return { path, ...data };
  },

  /**
   * Get signed URL for candidate audio review
   */
  async getAudioSignedUrl(path, expiresIn = 3600) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.storage
      .from(BUCKETS.AUDIO)
      .createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  /**
   * Remove a file from private storage
   */
  async deleteFile(bucket, path) {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  },
};

export default storageService;
