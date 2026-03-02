import { useSearchParams } from 'react-router-dom';
import ChatBox from '../components/ChatBox';

export default function ChatPage() {
  const [params] = useSearchParams();
  const roomId = params.get('roomId');

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">Ride Chat</h1>
      {roomId ? <ChatBox roomId={roomId} /> : <p>Missing roomId.</p>}
    </div>
  );
}
