import AudioPlayer from '../components/AudioPlayer';

const customPlaylist = [
  {
    title: 'Horizon',
    file: 'horizon'
  },
  {
    title: 'Inside Out',
    file: 'inside_out'
  }
];

export default function AudioPlayerPage() {
  return (
    <div className="w-full h-screen">
      <AudioPlayer playlist={customPlaylist} />
    </div>
  );
}