import React from 'react';

const phases = [
  { id: 'diagnosis', name: '진단', icon: '🔍', description: '대상/목적/핵심 메시지 파악' },
  { id: 'structuring', name: '구조화', icon: '📋', description: '스토리라인 및 목차 설계' },
  { id: 'detailing', name: '상세기획', icon: '📝', description: '슬라이드별 내용 기획' },
  { id: 'promptGeneration', name: '프롬프트', icon: '🎨', description: 'Nano Banana Pro 프롬프트 생성' },
];

const PhaseIndicator = ({ currentPhase, onPhaseClick, completedPhases }) => {
  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div className="phase-indicator">
      <div className="phase-track">
        {phases.map((phase, index) => {
          const isCompleted = completedPhases.includes(phase.id);
          const isCurrent = phase.id === currentPhase;
          const isAccessible = index <= currentIndex || isCompleted;

          return (
            <React.Fragment key={phase.id}>
              <div
                className={`phase-item ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${isAccessible ? 'accessible' : ''}`}
                onClick={() => isAccessible && onPhaseClick(phase.id)}
              >
                <div className="phase-icon">
                  {isCompleted ? '✓' : phase.icon}
                </div>
                <div className="phase-info">
                  <span className="phase-name">{phase.name}</span>
                  <span className="phase-desc">{phase.description}</span>
                </div>
              </div>
              {index < phases.length - 1 && (
                <div className={`phase-connector ${index < currentIndex ? 'active' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default PhaseIndicator;
