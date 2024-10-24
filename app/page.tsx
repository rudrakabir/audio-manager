'use client';
import AudioManager from '@/components/AudioManager';
// or use relative path
// import AudioManager from '../components/AudioManager';

export default function Home() {
  return (
    <main className="min-h-screen">
      <AudioManager />
    </main>
  );
}