import React from 'react';
import { Html } from '@react-three/drei';
import { useGameStore } from '../../store/useGameStore';
import { useTranslation } from '../../utils/i18n';

interface LabelRendererProps {
    position: [number, number, number];
    text: string;
}

export const LabelRenderer: React.FC<LabelRendererProps> = ({ position, text }) => {
    const showLabels = useGameStore(state => state.settings.showLabels);
    const { t } = useTranslation();

    if (!showLabels) return null;

    return (
        <Html position={position} center distanceFactor={10} zIndexRange={[100, 0]}>
            <div style={{
                background: 'rgba(0, 0, 0, 0.6)',
                color: 'white',
                padding: '2px 5px',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'Courier New',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none'
            }}>
                {t(text as any)}
            </div>
        </Html>
    );
};
