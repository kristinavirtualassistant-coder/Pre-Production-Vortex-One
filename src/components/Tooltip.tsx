import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, Sparkles, ShieldCheck, Database, Building2 } from 'lucide-react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TooltipProps {
  title?: string;
  content: React.ReactNode;
  category?: string;
  position?: TooltipPosition;
  delay?: number;
  shortcut?: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  title,
  content,
  category,
  position = 'top',
  delay = 150,
  shortcut,
  className = '',
  children,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [calculatedPosition, setCalculatedPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculateCoords = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    let pos = position;

    if (pos === 'auto') {
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      pos = spaceAbove > 180 || spaceAbove > spaceBelow ? 'top' : 'bottom';
    }

    setCalculatedPosition(pos as 'top' | 'bottom' | 'left' | 'right');

    const gap = 8;
    let top = 0;
    let left = 0;

    switch (pos) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
        break;
      case 'top':
      default:
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        break;
    }

    setCoords({ top, left });
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      calculateCoords();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getPositionClasses = () => {
    switch (calculatedPosition) {
      case 'bottom':
        return '-translate-x-1/2 translate-y-0';
      case 'left':
        return '-translate-x-full -translate-y-1/2';
      case 'right':
        return 'translate-x-0 -translate-y-1/2';
      case 'top':
      default:
        return '-translate-x-1/2 -translate-y-full';
    }
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      className={`inline-flex items-center ${className}`}
    >
      {children}

      {isVisible && !disabled && (
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
          }}
          className={`z-50 pointer-events-none transition-all duration-150 transform ${getPositionClasses()}`}
        >
          <div className="bg-slate-900/95 text-white border border-slate-700/80 rounded-xl shadow-2xl p-3 max-w-xs sm:max-w-sm text-left backdrop-blur-md animate-in fade-in zoom-in-95">
            {(title || category) && (
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700/60 gap-2">
                {title && (
                  <span className="font-bold text-xs text-white tracking-tight flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{title}</span>
                  </span>
                )}
                {category && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/50 shrink-0">
                    {category}
                  </span>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-200 leading-relaxed font-normal">
              {content}
            </div>

            {shortcut && (
              <div className="mt-2 pt-1 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span>Shortcut</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[9px]">
                  {shortcut}
                </kbd>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface InfoTooltipProps {
  title?: string;
  content?: React.ReactNode;
  text?: string;
  entry?: { title?: string; category?: string; content: React.ReactNode };
  category?: string;
  position?: TooltipPosition;
  size?: 'xs' | 'sm' | 'md';
  icon?: 'info' | 'help';
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  text,
  entry,
  category,
  position = 'top',
  size = 'xs',
  icon = 'help',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  const IconComp = icon === 'info' ? Info : HelpCircle;

  let resolvedTitle = title || entry?.title;
  let resolvedCategory = category || entry?.category || (entry ? 'Explanation' : undefined);
  let resolvedContent: React.ReactNode = content || text || entry?.content;

  // Handle case where text or content is a glossary object { title, category, content }
  const targetObj = text || content;
  if (targetObj && typeof targetObj === 'object' && !React.isValidElement(targetObj) && 'content' in targetObj) {
    const glossaryObj = targetObj as { title?: string; category?: string; content: React.ReactNode };
    resolvedTitle = resolvedTitle || glossaryObj.title;
    resolvedCategory = resolvedCategory || glossaryObj.category;
    resolvedContent = glossaryObj.content;
  }

  if (!resolvedContent) return null;

  return (
    <Tooltip title={resolvedTitle} content={resolvedContent} category={resolvedCategory} position={position}>
      <span
        className={`inline-flex items-center justify-center text-slate-400 hover:text-cyan-600 cursor-help transition-colors ml-1 ${className}`}
        aria-label={resolvedTitle || 'Information'}
      >
        <IconComp className={sizeClasses[size]} />
      </span>
    </Tooltip>
  );
};

/**
 * Standard Glossary Definitions for Real Estate & AI Terminology
 */
const BASE_GLOSSARY = {
  APN: {
    title: 'APN (Assessor Parcel Number)',
    category: 'Real Estate Data',
    content:
      'The unique government ID assigned to every real estate parcel by the county tax assessor (e.g. 119-241-08 in Orange County). Used to track zoning, lot size, and tax assessments.',
  },
  ABSENTEE: {
    title: 'Absentee Landlord',
    category: 'Lead Qualification',
    content:
      'Property where the owner’s tax mailing address is different from the physical property situs. High-probability prospect for property management or off-market acquisition.',
  },
  EQUITY: {
    title: 'Estimated Equity',
    category: 'Financials',
    content:
      'Estimated market value minus outstanding mortgages and recorded liens. High equity (>60%) indicates financial flexibility and strong seller motivation.',
  },
  ASSESSED_VALUE: {
    title: 'Prop 13 Assessed Value',
    category: 'Tax & Valuation',
    content:
      'Official county tax assessment. In California under Proposition 13, assessed values increase max 2%/year, meaning market value is often significantly higher.',
  },
  MARKET_VALUE: {
    title: 'Estimated Market Valuation',
    category: 'Valuation',
    content:
      'Current estimated open-market sales value based on recent neighborhood comparable sales, unit counts, and spatial appreciation trends.',
  },
  LEAD_SCORE: {
    title: 'AI Lead Score (0–100)',
    category: 'AI Scoring',
    content:
      'Sub-Agent 2 composite rating evaluated from equity percentage, absentee ownership, building age, unit count, and tax history. 80+ is High Priority.',
  },
  TCPA: {
    title: 'TCPA & DNC Safe Harbor',
    category: 'Compliance',
    content:
      'Federal Telephone Consumer Protection Act compliance. Verifies phone numbers against National Do Not Call lists and restricts calling hours.',
  },
  HUMAN_APPROVAL: {
    title: 'Human Approval Gatekeeper',
    category: 'AI Governance',
    content:
      'Safety brake: AI agents draft emails, SMS batches, and dialer campaigns, but require manual operator sign-off before anything is dispatched.',
  },
  PROVENANCE: {
    title: 'Cryptographic Provenance',
    category: 'Audit & Trust',
    content:
      'Immutable audit hash verifying the authoritative county assessor database, exact query timestamp, and ingest pipeline used for this record.',
  },
  ZONING: {
    title: 'Municipal Zoning Code',
    category: 'Spatial Intelligence',
    content:
      'Official city/county zoning designation determining permitted land use, density limits (e.g., R-3 multi-family, C-2 commercial), and development potential.',
  },
  UNITS_COUNT: {
    title: 'Unit Count',
    category: 'Asset Specs',
    content:
      'Total number of residential or commercial units on the parcel. Multi-family (2–20+ units) represents prime acquisition and management inventory.',
  },
  TAX_STATUS: {
    title: 'Tax & Delinquency Status',
    category: 'Tax Records',
    content:
      'Current county property tax status. Delinquent taxes or impending auction dates indicate distressed owners with high urgency to sell or recapitalize.',
  },
  MERGE_VARS: {
    title: 'Merge Variable Tokens',
    category: 'Outreach',
    content:
      'Dynamic tags (e.g. {{owner_name}}, {{property_address}}) automatically replaced with verified county records when generating outreach messages.',
  },
  ORCHESTRATOR: {
    title: 'Agent 1 Master Orchestrator',
    category: 'Multi-Agent Core',
    content:
      'The primary reasoning agent that parses your goal, decomposes it into DAG sub-tasks, assigns work to Sub-Agents 0–9, and synthesizes the final result.',
  },
  QA_CONFIDENCE: {
    title: 'QA Confidence Rating',
    category: 'Quality Assurance',
    content:
      'Sub-Agent 9 verification score confirming that math calculations, public record lookups, and generated content are factually grounded and hallucination-free.',
  },
};

export const GLOSSARY = {
  ...BASE_GLOSSARY,
  ABSENTEE_OWNER: BASE_GLOSSARY.ABSENTEE,
  TAX_DELINQUENT: BASE_GLOSSARY.TAX_STATUS,
  ESTIMATED_VALUE: BASE_GLOSSARY.MARKET_VALUE,
};
