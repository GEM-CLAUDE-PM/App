import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface OrgNodeProps {
  node: any;
  data: any[];
  onSelect: (node: any) => void;
  expandedNodes: string[];
  toggleNode: (id: string) => void;
}

export const OrgNode: React.FC<OrgNodeProps> = ({ node, data, onSelect, expandedNodes, toggleNode }) => {
  const children = data.filter((item: any) => item.parentId === node.id);
  const isExpanded = expandedNodes.includes(node.id);
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col items-center relative">
      <div 
        onClick={() => onSelect(node)}
        className={`px-4 py-3 rounded-xl shadow-sm text-center w-48 z-10 cursor-pointer hover:scale-105 transition-transform border-2 relative
          ${node.role.includes('HSE') ? 'bg-rose-50 border-rose-200 hover:border-rose-400' : 
            node.role.includes('Giám đốc') ? 'bg-emerald-600 border-emerald-600 hover:border-emerald-300 text-white' :
            node.role.includes('Chỉ huy') ? 'bg-blue-600 border-blue-600 hover:border-blue-300 text-white' :
            'bg-white border-slate-200 hover:border-slate-400'
          }`}
      >
        <p className={`text-xs uppercase font-bold tracking-wider mb-1 
          ${node.role.includes('HSE') ? 'text-rose-600' : 
            (node.role.includes('Giám đốc') || node.role.includes('Chỉ huy')) ? 'text-white/80' : 
            'text-slate-500'}`}
        >
          {node.role}
        </p>
        <p className={`font-semibold text-sm 
          ${node.role.includes('HSE') ? 'text-rose-800' : 
            (node.role.includes('Giám đốc') || node.role.includes('Chỉ huy')) ? 'text-white' : 
            'text-slate-800'}`}
        >
          {node.name}
        </p>
        
        {hasChildren && (
          <button 
            onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-400 shadow-sm z-20"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="flex mt-6 relative">
          <div className="absolute -top-6 left-1/2 w-px h-6 bg-slate-300 -translate-x-1/2"></div>
          
          {children.length > 1 && (
            <div className="absolute top-0 h-px bg-slate-300" style={{
              left: `calc(50% / ${children.length})`,
              right: `calc(50% / ${children.length})`
            }}></div>
          )}

          {children.map((child: any) => (
            <div key={child.id} className="relative flex-1 flex flex-col items-center px-2">
              <div className="absolute top-0 left-1/2 w-px h-6 bg-slate-300 -translate-x-1/2"></div>
              <div className="mt-6">
                <OrgNode 
                  node={child} 
                  data={data} 
                  onSelect={onSelect} 
                  expandedNodes={expandedNodes} 
                  toggleNode={toggleNode} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
