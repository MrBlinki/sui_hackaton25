import App from "./App";
import AudioPlayer from "./components/AudioPlayer"; // adjust the path

export default function Home() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <AudioPlayer />
    </div>
  );
}
