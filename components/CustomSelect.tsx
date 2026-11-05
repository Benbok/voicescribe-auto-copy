import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    description?: string;
    badge?: string;
    badgeColor?: 'blue' | 'purple' | 'amber' | 'emerald' | 'gray';
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    label?: string;
    helperText?: string;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    className?: string;
    variant?: 'default' | 'blue' | 'amber';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    label,
    helperText,
    placeholder = 'Выберите...',
    disabled = false,
    id,
    className = '',
    variant = 'default',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);
    const triggerId = id || useId();

    const selectedOption = options.find((opt) => opt.value === value);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Scroll focused option into view
    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listboxRef.current) {
            const focusedEl = listboxRef.current.children[focusedIndex] as HTMLElement;
            if (focusedEl) {
                focusedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    const handleTriggerClick = () => {
        if (disabled) return;
        const nextState = !isOpen;
        setIsOpen(nextState);
        if (nextState) {
            const index = options.findIndex((opt) => opt.value === value);
            setFocusedIndex(index >= 0 ? index : 0);
        }
    };

    const handleSelect = (option: SelectOption) => {
        if (option.disabled) return;
        onChange(option.value);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setIsOpen(true);
                const index = options.findIndex((opt) => opt.value === value);
                setFocusedIndex(index >= 0 ? index : 0);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                let next = focusedIndex + 1;
                while (next < options.length && options[next].disabled) {
                    next++;
                }
                if (next < options.length) setFocusedIndex(next);
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();
                let prev = focusedIndex - 1;
                while (prev >= 0 && options[prev].disabled) {
                    prev--;
                }
                if (prev >= 0) setFocusedIndex(prev);
                break;
            }
            case 'Enter':
            case ' ': {
                e.preventDefault();
                if (focusedIndex >= 0 && focusedIndex < options.length) {
                    handleSelect(options[focusedIndex]);
                }
                break;
            }
            case 'Tab': {
                setIsOpen(false);
                break;
            }
        }
    };

    const getVariantClasses = () => {
        switch (variant) {
            case 'blue':
                return {
                    trigger: isOpen
                        ? 'border-blue-500/80 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
                        : 'border-blue-500/30 hover:border-blue-500/60',
                    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                };
            case 'amber':
                return {
                    trigger: isOpen
                        ? 'border-amber-500/80 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10'
                        : 'border-amber-500/30 hover:border-amber-500/60',
                    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                };
            default:
                return {
                    trigger: isOpen
                        ? 'border-blue-500/70 ring-2 ring-blue-500/20 shadow-lg shadow-blue-500/10'
                        : 'border-white/10 hover:border-white/20',
                    badge: 'bg-white/10 text-gray-300 border-white/10',
                };
        }
    };

    const variantStyles = getVariantClasses();

    const getBadgeClass = (color?: SelectOption['badgeColor']) => {
        switch (color) {
            case 'blue':
                return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
            case 'purple':
                return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
            case 'amber':
                return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
            case 'emerald':
                return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
            default:
                return 'bg-white/10 text-gray-300 border-white/10';
        }
    };

    return (
        <div ref={containerRef} className={`relative w-full ${className}`}>
            {label && (
                <label
                    id={`${triggerId}-label`}
                    htmlFor={triggerId}
                    className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2"
                >
                    {label}
                </label>
            )}

            <button
                id={triggerId}
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-labelledby={label ? `${triggerId}-label` : undefined}
                disabled={disabled}
                onClick={handleTriggerClick}
                onKeyDown={handleKeyDown}
                className={`w-full group flex items-center justify-between gap-3 px-4 py-3 text-left rounded-xl glass bg-gradient-to-b from-white/[0.06] to-white/[0.02] border transition-all duration-200 outline-none interactive ${
                    variantStyles.trigger
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.06]'}`}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {selectedOption?.icon && (
                        <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-gray-300 group-hover:text-white transition-colors">
                            {selectedOption.icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                                {selectedOption ? selectedOption.label : placeholder}
                            </span>
                            {selectedOption?.badge && (
                                <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${getBadgeClass(
                                        selectedOption.badgeColor
                                    )}`}
                                >
                                    {selectedOption.badge}
                                </span>
                            )}
                        </div>
                        {selectedOption?.description && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                                {selectedOption.description}
                            </p>
                        )}
                    </div>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-400' : 'group-hover:text-gray-200'
                    }`}
                />
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 animate-scale-in">
                    <ul
                        ref={listboxRef}
                        role="listbox"
                        tabIndex={-1}
                        className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 rounded-2xl bg-[#12121b]/95 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/80 space-y-1 focus:outline-none"
                    >
                        {options.map((option, index) => {
                            const isSelected = option.value === value;
                            const isFocused = index === focusedIndex;

                            return (
                                <li
                                    key={option.value}
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(option)}
                                    onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
                                    className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer select-none text-left ${
                                        option.disabled
                                            ? 'opacity-40 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-blue-600/20 text-white border border-blue-500/30'
                                            : isFocused
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {option.icon && (
                                            <div
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                                                        : 'bg-white/5 border-white/10 text-gray-400'
                                                }`}
                                            >
                                                {option.icon}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`text-sm font-medium truncate ${
                                                        isSelected ? 'text-blue-300 font-semibold' : 'text-gray-200'
                                                    }`}
                                                >
                                                    {option.label}
                                                </span>
                                                {option.badge && (
                                                    <span
                                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${getBadgeClass(
                                                            option.badgeColor
                                                        )}`}
                                                    >
                                                        {option.badge}
                                                    </span>
                                                )}
                                            </div>
                                            {option.description && (
                                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                                                    {option.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                                            <Check className="w-3.5 h-3.5" />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {helperText && <p className="text-xs text-gray-500 mt-1.5 px-1">{helperText}</p>}
        </div>
    );
};

export default CustomSelect;

