import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { ClientEvents, ServerEvents, RoomUser } from '../types/whiteboard.types';

interface RoomVoiceChatProps {
    socket: Socket | null;
    roomId: string;
    user: any;
    roomUsers: RoomUser[];
}

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const RoomVoiceChat: React.FC<RoomVoiceChatProps> = ({ socket, roomId, user, roomUsers }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState<{ [socketId: string]: MediaStream }>({});

    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
    const audioRefs = useRef<{ [socketId: string]: HTMLAudioElement | null }>({});

    const currentUserSocketId = socket?.id;

    // Cleanup WebRTC connections
    const cleanup = useCallback(() => {
        Object.values(peersRef.current).forEach(peer => peer.close());
        peersRef.current = {};
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setRemoteStreams({});
        setIsConnected(false);
    }, []);

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    // Handle new users (create Offers for them if we are connected)
    useEffect(() => {
        if (!isConnected || !socket || !localStreamRef.current) return;

        roomUsers.forEach(rUser => {
            const peerSocketId = rUser.socketId;
            if (peerSocketId !== currentUserSocketId && !peersRef.current[peerSocketId]) {
                createPeerConnection(peerSocketId, true);
            }
        });
    }, [roomUsers, isConnected, socket, currentUserSocketId]);

    const createPeerConnection = (targetSocketId: string, isInitiator: boolean) => {
        if (!socket || !localStreamRef.current) return null;

        const peer = new RTCPeerConnection(rtcConfig);
        peersRef.current[targetSocketId] = peer;

        // Add local stream tracks to peer
        localStreamRef.current.getTracks().forEach(track => {
            if (localStreamRef.current) {
                peer.addTrack(track, localStreamRef.current);
            }
        });

        // Handle incoming ICE candidates
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit(ClientEvents.WEBRTC_ICE_CANDIDATE, {
                    targetSocketId,
                    candidate: event.candidate,
                    roomId,
                });
            }
        };

        // Handle incoming streams
        peer.ontrack = (event) => {
            const stream = event.streams[0];
            setRemoteStreams(prev => ({
                ...prev,
                [targetSocketId]: stream
            }));
        };

        // Connection state changes
        peer.onconnectionstatechange = () => {
            if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed' || peer.connectionState === 'closed') {
                setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[targetSocketId];
                    return newStreams;
                });
                delete peersRef.current[targetSocketId];
            }
        };

        if (isInitiator) {
            peer.createOffer()
                .then(offer => peer.setLocalDescription(offer))
                .then(() => {
                    socket.emit(ClientEvents.WEBRTC_OFFER, {
                        targetSocketId,
                        offer: peer.localDescription,
                        roomId,
                        userId: user?.id,
                        userName: user?.username || `User-${socket.id?.substring(0, 4)}`
                    });
                })
                .catch(err => console.error("Error creating WebRTC offer:", err));
        }

        return peer;
    };

    // Listen to Server Signaling Events
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleOffer = async (payload: any) => {
            const { offer, senderSocketId } = payload;
            let peer = peersRef.current[senderSocketId];

            if (!peer) {
                peer = createPeerConnection(senderSocketId, false) as RTCPeerConnection;
            }

            if (peer) {
                await peer.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                socket.emit(ClientEvents.WEBRTC_ANSWER, {
                    targetSocketId: senderSocketId,
                    answer: peer.localDescription,
                    roomId
                });
            }
        };

        const handleAnswer = async (payload: any) => {
            const { answer, senderSocketId } = payload;
            const peer = peersRef.current[senderSocketId];
            if (peer) {
                await peer.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleIceCandidate = async (payload: any) => {
            const { candidate, senderSocketId } = payload;
            const peer = peersRef.current[senderSocketId];
            if (peer && candidate) {
                try {
                    await peer.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (e) {
                    console.error("Error adding ice candidate:", e);
                }
            }
        };

        socket.on(ServerEvents.WEBRTC_OFFER, handleOffer);
        socket.on(ServerEvents.WEBRTC_ANSWER, handleAnswer);
        socket.on(ServerEvents.WEBRTC_ICE_CANDIDATE, handleIceCandidate);

        return () => {
            socket.off(ServerEvents.WEBRTC_OFFER, handleOffer);
            socket.off(ServerEvents.WEBRTC_ANSWER, handleAnswer);
            socket.off(ServerEvents.WEBRTC_ICE_CANDIDATE, handleIceCandidate);
        };
    }, [socket, isConnected, roomId]);

    // Auto-play audio elements when streams arrive
    useEffect(() => {
        Object.keys(remoteStreams).forEach(socketId => {
            const stream = remoteStreams[socketId];
            const audioElement = audioRefs.current[socketId];
            if (audioElement && audioElement.srcObject !== stream) {
                audioElement.srcObject = stream;
                audioElement.play().catch(e => console.error("Auto-play blocked:", e));
            }
        });
    }, [remoteStreams]);

    const toggleVoice = async () => {
        if (isConnected) {
            cleanup();
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                localStreamRef.current = stream;
                setIsConnected(true);
                setIsMuted(false);

                // Let effect handle connecting to existing peers
            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Microphone access is required for voice chat.");
            }
        }
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    return (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">

            {/* Hidden audio elements for remote participants */}
            {Object.keys(remoteStreams).map(socketId => (
                <audio
                    key={socketId}
                    ref={el => audioRefs.current[socketId] = el}
                    autoPlay
                    className="hidden"
                />
            ))}

            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-zinc-900 text-white p-2 rounded-xl shadow-lg border border-zinc-800 flex items-center gap-2"
            >
                {/* Connection Toggle */}
                <button
                    onClick={toggleVoice}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs transition-colors ${isConnected
                            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                            : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                        }`}
                >
                    {isConnected ? (
                        <>
                            <PhoneOff size={16} />
                            Disconnect
                        </>
                    ) : (
                        <>
                            <Phone size={16} />
                            Join Voice
                        </>
                    )}
                </button>

                {/* Microphone Mute Toggle */}
                {isConnected && (
                    <AnimatePresence>
                        <motion.button
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            onClick={toggleMute}
                            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isMuted
                                    ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                }`}
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                        </motion.button>
                    </AnimatePresence>
                )}

                {/* Status Indicator */}
                {isConnected && (
                    <div className="flex items-center gap-2 px-2 border-l border-zinc-700 ml-1">
                        <Volume2 size={14} className={Object.keys(remoteStreams).length > 0 ? 'text-green-400' : 'text-zinc-500'} />
                        <span className="text-[10px] text-zinc-400 font-bold">
                            {Object.keys(remoteStreams).length} Peer(s)
                        </span>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default RoomVoiceChat;
