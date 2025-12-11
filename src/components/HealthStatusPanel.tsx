// components/HealthStatusPanel.tsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket'; 
import { Zap, Server, Database, TrendingUp, XCircle, CheckCircle, Clock } from 'lucide-react';

// État de santé simulé pour les services non gérés par le WebSocket
// En production, ces données viendraient d'un hook ou d'un endpoint de monitoring
interface ServiceStatus {
    name: string;
    status: 'Operational' | 'Degraded' | 'Offline';
    latency?: number; // ms
}

// Fonction utilitaire pour simuler l'état des services et de la latence
const useHealthSimulation = () => {
    const { connected } = useWebSocket();
    const [latency, setLatency] = useState(50);
    
    // Simule la latence et l'état des services
    useEffect(() => {
        const interval = setInterval(() => {
            // Simuler une latence réaliste (20ms à 150ms)
            setLatency(Math.floor(Math.random() * (150 - 20 + 1)) + 20); 
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const services: ServiceStatus[] = useMemo(() => ([
        { name: 'RPC Node', status: latency < 100 ? 'Operational' : 'Degraded', latency: latency },
        { name: 'Paymaster', status: Math.random() > 0.1 ? 'Operational' : 'Degraded' },
        { name: 'Database', status: Math.random() > 0.05 ? 'Operational' : 'Operational' },
        { name: 'Oracle Feed', status: 'Operational' }, // Crucial, souvent stable
        { name: 'Backend API', status: Math.random() > 0.1 ? 'Operational' : 'Degraded' },
        { name: 'Executor', status: Math.random() > 0.1 ? 'Operational' : 'Offline' },
    ]), [latency]);

    return { services, wsConnected: connected, latency };
};

// Fonction utilitaire pour le rendu de l'icône de statut
const StatusIcon: React.FC<{ status: ServiceStatus['status'] | boolean }> = ({ status }) => {
    const finalStatus = typeof status === 'boolean' ? (status ? 'Operational' : 'Offline') : status;
    
    switch (finalStatus) {
        case 'Operational':
            return <CheckCircle className="w-4 h-4 text-blue-500 mr-2" />;
        case 'Degraded':
            return <Clock className="w-4 h-4 text-yellow-500 mr-2" />;
        case 'Offline':
            return <XCircle className="w-4 h-4 text-red-500 mr-2" />;
        default:
            return <Server className="w-4 h-4 text-gray-400 mr-2" />;
    }
};

// Composant de l'icône d'état principale (celle qui est fixe)
const StatusIndicator: React.FC<{ overallStatus: ServiceStatus['status'] }> = ({ overallStatus }) => {
    const colorClass = overallStatus === 'Operational' ? 'bg-blue-600' : 
                       overallStatus === 'Degraded' ? 'bg-yellow-500' : 'bg-red-600';
    
    return (
        <div className={`p-1 rounded-full ${colorClass} shadow-lg flex items-center justify-center`}>
            <Zap className="w-5 h-5 text-white" />
        </div>
    );
};

// Composant Principal (Panneau fixe + Popover)
export const HealthStatusPanel: React.FC = () => {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const { services, wsConnected, latency } = useHealthSimulation();

    // Déterminer l'état global
    const overallStatus = useMemo(() => {
        if (!wsConnected || services.some(s => s.status === 'Offline')) return 'Offline';
        if (services.some(s => s.status === 'Degraded')) return 'Degraded';
        return 'Operational';
    }, [services, wsConnected]);

    // Formatage des détails
    const statusDetails: { icon: React.ReactNode, label: string, status: ServiceStatus['status'] | boolean, value?: string | number }[] = useMemo(() => ([
        { label: 'System Operational', status: overallStatus, icon: <Server className="w-4 h-4 text-gray-500 mr-2" /> },
        { label: 'WebSocket Connection', status: wsConnected, icon: <TrendingUp className="w-4 h-4 text-gray-500 mr-2" /> },
        // Ajout des débits simulés pour l'exhaustivité
        { label: 'Client Latency', status: latency < 100 ? 'Operational' : 'Degraded', value: `${latency} ms`, icon: <Clock className="w-4 h-4 text-gray-500 mr-2" /> },
        { label: 'Client Download Speed', status: 'Operational', value: '45 Mbps', icon: <TrendingUp className="w-4 h-4 text-gray-500 mr-2 rotate-180" /> },
        { label: 'Frontend State', status: 'Operational', icon: <Server className="w-4 h-4 text-gray-500 mr-2" /> },
        // Services simulés
        ...services.map(s => ({ 
            label: s.name, 
            status: s.status, 
            icon: <Database className="w-4 h-4 text-gray-500 mr-2" />,
            value: s.name === 'RPC Node' ? `${s.latency} ms` : undefined,
        })),
        { label: 'Database', status: 'Operational', icon: <Database className="w-4 h-4 text-gray-500 mr-2" /> },
        { label: 'Backend API', status: 'Operational', icon: <Server className="w-4 h-4 text-gray-500 mr-2" /> },
        { label: 'Executor', status: 'Operational', icon: <Zap className="w-4 h-4 text-gray-500 mr-2" /> },
    ]), [overallStatus, wsConnected, latency, services]);


    return (
        // MODIFICATION DU POSITIONNEMENT : fixed bottom-2 right-4
        // Cela place le bouton juste au-dessus du BottomBar et à droite du OrderPanel
        <div className="fixed bottom-2 right-4 z-50 flex flex-col items-end">
            
            {/* 1. Popover (Panneau de Détails) */}
            {isPopoverOpen && (
                // Positionné relativement au bouton parent, aligné à droite et au-dessus
                <div 
                    // Utilisez 'bottom-full' pour le positionner juste au-dessus du bouton
                    className="absolute bottom-full right-0 mb-2 w-72 bg-white shadow-xl rounded-lg border border-gray-200 p-3 text-sm font-['Source_Code_Pro',_monospace]"
                    style={{ zIndex: 60 }}
                >
                    <h3 className="font-bold text-lg mb-2 text-blue-600 border-b pb-1">System Health Status</h3>
                    
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                        {statusDetails.map((detail, index) => (
                            <div key={index} className="flex justify-between items-center py-1">
                                <div className="flex items-center text-gray-700">
                                    <StatusIcon status={detail.status} />
                                    <span className="font-medium">{detail.label}</span>
                                </div>
                                <span className={`font-semibold ${detail.status === 'Operational' ? 'text-blue-600' : detail.status === 'Degraded' ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {detail.value || (typeof detail.status === 'boolean' ? (detail.status ? 'Operational' : 'Offline') : detail.status)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Bouton Fixe (Le développeur) */}
            <button
                onClick={() => setIsPopoverOpen(prev => !prev)}
                className="flex items-center space-x-2 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition duration-150"
                title="Application Health Status"
            >
                <StatusIndicator overallStatus={overallStatus} />
                <span className="font-semibold text-sm">
                    {overallStatus === 'Operational' ? 'Operational System' : 
                     overallStatus === 'Degraded' ? 'Degraded System' : 'System Offline'}
                </span>
            </button>
        </div>
    );
};