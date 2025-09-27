import SimpleAudioPlayer from '../components/SimpleAudioPlayer';

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

export default function SimpleAudioPlayerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
      <SimpleAudioPlayer playlist={customPlaylist} />
    </div>
  );
}