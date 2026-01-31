import { useState, useEffect } from 'react';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface OnboardingModalProps {
  onComplete: () => void;
  isOpen: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Upload Your Image',
    description: 'Start by dragging and dropping an image or clicking to browse. We support PNG, JPG, WebP, HEIC, GIF, and BMP files up to 10MB.',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Choose a Mode',
    description: 'Select the conversion mode that fits your project: Silhouette for single-color decals, Multi-Color for layered vinyl, or Line Art for outlines and stencils.',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    title: 'Use Presets or Customize',
    description: 'Quick start with presets like "Single Color Decal" or "Multi-Color Vinyl", or fine-tune detail, smoothing, and cleanup options for perfect results.',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
      </svg>
    ),
  },
  {
    title: 'Generate & Preview',
    description: 'Click "Generate SVG" to convert your image. Use zoom, pan, and toggle layers to preview exactly how it will look when cut.',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    title: 'Export for Cricut',
    description: 'Download your SVG ready for Cricut Design Space. The file is optimized with proper dimensions and compatible path formats.',
    icon: (
      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

const STORAGE_KEY = 'image-to-svg-onboarding-complete';

export function OnboardingModal({ onComplete, isOpen }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleComplete();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Welcome to Image to SVG</h2>
            <button
              onClick={handleSkip}
              className="text-white/80 hover:text-white text-sm font-medium"
            >
              Skip
            </button>
          </div>
          {/* Step indicators */}
          <div className="flex gap-2 mt-3">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`
                  h-1.5 rounded-full transition-all
                  ${index === currentStep
                    ? 'bg-white w-8'
                    : index < currentStep
                      ? 'bg-white/60 w-4'
                      : 'bg-white/30 w-4'
                  }
                `}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center text-primary-600 mb-4">
              {step.icon}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {step.title}
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Step counter */}
          <p className="text-center text-sm text-gray-400 mt-6">
            Step {currentStep + 1} of {ONBOARDING_STEPS.length}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${currentStep === 0
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }
            `}
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            {isLastStep ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to check if onboarding should be shown
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) !== 'true';
}

// Helper to reset onboarding (for testing or "Show Tutorial" button)
export function resetOnboarding(): void {
  localStorage.removeItem(STORAGE_KEY);
}
