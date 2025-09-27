import AudioPlayer from '../components/AudioPlayer';

const customPlaylist = [
  {
    title: 'Rave Digger',
    file: 'rave_digger'
  },
  {
    title: '80s Vibe',
    file: '80s_vibe'
  },
  {
    title: 'Running Out',
    file: 'running_out'
  }
];

export default function AudioPlayerPage() {
  return (
    <div className="w-full h-screen">
      <AudioPlayer playlist={customPlaylist} />
    </div>
  );
}