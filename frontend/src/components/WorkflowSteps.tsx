interface WorkflowStep {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'upload',
    label: 'Upload Image',
    shortLabel: 'Upload',
    description: 'Add your image file',
  },
  {
    id: 'configure',
    label: 'Configure Settings',
    shortLabel: 'Configure',
    description: 'Adjust mode & options',
  },
  {
    id: 'generate',
    label: 'Generate SVG',
    shortLabel: 'Generate',
    description: 'Convert to vectors',
  },
  {
    id: 'export',
    label: 'Export for Cricut',
    shortLabel: 'Export',
    description: 'Download your file',
  },
];

export type WorkflowStage = 'upload' | 'configure' | 'generate' | 'export';

interface WorkflowStepsProps {
  currentStage: WorkflowStage;
  hasImage: boolean;
  hasSvg: boolean;
}

export function WorkflowSteps({ currentStage, hasImage, hasSvg }: WorkflowStepsProps) {
  const getStepStatus = (stepId: string): 'completed' | 'current' | 'upcoming' => {
    const stepOrder = ['upload', 'configure', 'generate', 'export'];
    const currentIndex = stepOrder.indexOf(currentStage);
    const stepIndex = stepOrder.indexOf(stepId);

    // Special handling based on actual state
    if (stepId === 'upload' && hasImage) return 'completed';
    if (stepId === 'configure' && hasImage && hasSvg) return 'completed';
    if (stepId === 'generate' && hasSvg) return 'completed';

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <nav aria-label="Workflow progress">
          <ol className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const status = getStepStatus(step.id);
              const isLast = index === WORKFLOW_STEPS.length - 1;

              return (
                <li key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center">
                    {/* Step circle */}
                    <div
                      className={`
                        flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all
                        ${status === 'completed'
                          ? 'bg-primary-600 text-white'
                          : status === 'current'
                            ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-600 ring-offset-2'
                            : 'bg-gray-100 text-gray-400'
                        }
                      `}
                    >
                      {status === 'completed' ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>

                    {/* Step text */}
                    <div className="ml-3 hidden sm:block">
                      <p
                        className={`
                          text-sm font-medium
                          ${status === 'current' ? 'text-primary-700' : status === 'completed' ? 'text-gray-900' : 'text-gray-400'}
                        `}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500 hidden md:block">
                        {step.description}
                      </p>
                    </div>
                    <span
                      className={`
                        ml-2 text-xs font-medium sm:hidden
                        ${status === 'current' ? 'text-primary-700' : status === 'completed' ? 'text-gray-700' : 'text-gray-400'}
                      `}
                    >
                      {step.shortLabel}
                    </span>
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex-1 mx-4">
                      <div
                        className={`
                          h-0.5 transition-colors
                          ${status === 'completed' ? 'bg-primary-600' : 'bg-gray-200'}
                        `}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
}

// Helper to determine current workflow stage based on app state
export function determineWorkflowStage(
  hasImage: boolean,
  hasSvg: boolean,
  isProcessing: boolean
): WorkflowStage {
  if (!hasImage) return 'upload';
  if (isProcessing) return 'generate';
  if (!hasSvg) return 'configure';
  return 'export';
}
