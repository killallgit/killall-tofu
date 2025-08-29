/**
 * Parse command string into array of arguments
 * Handles quoted strings properly
 */
export const parseCommandString = (command: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
    } else if (!inQuotes && char === ' ') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts.length > 0 ? parts : ['terraform', 'destroy', '-auto-approve'];
};

/**
 * Get the default execution command
 */
export const getDefaultCommand = (): string[] => {
  return ['terraform', 'destroy', '-auto-approve'];
};

/**
 * Validate command arguments
 */
export const validateCommandArgs = (args: string[]): boolean => {
  return args.length > 0 && args[0].length > 0;
};