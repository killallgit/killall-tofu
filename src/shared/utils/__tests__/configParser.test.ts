import { parseYaml } from '../configParser';

describe('configParser', () => {
  describe('parseYaml', () => {
    it('should parse valid YAML string', () => {
      const yamlContent = `
version: 1
timeout: "2 hours"
name: "Test Project"
tags:
  - dev
  - test
`;
      
      const result = parseYaml(yamlContent);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          version: 1,
          timeout: '2 hours',
          name: 'Test Project',
          tags: ['dev', 'test']
        });
      }
    });

    it('should parse simple YAML objects', () => {
      const yamlContent = 'key: value\nother: 123';
      
      const result = parseYaml(yamlContent);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          key: 'value',
          other: 123
        });
      }
    });

    it('should handle empty YAML content', () => {
      const result = parseYaml('');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    it('should handle whitespace-only content', () => {
      const result = parseYaml('   \n\t  ');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    it('should reject invalid YAML syntax', () => {
      const invalidYaml = `
version: 1
timeout: "unclosed string
name: test
`;
      
      const result = parseYaml(invalidYaml);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('YAML parsing failed');
      }
    });

    it('should reject malformed YAML structure', () => {
      const invalidYaml = `
- item1
  - nested_under_list_item
key: value
`;
      
      const result = parseYaml(invalidYaml);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('YAML parsing failed');
      }
    });

    it('should handle arrays', () => {
      const yamlContent = `
- item1
- item2
- item3
`;
      
      const result = parseYaml(yamlContent);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(['item1', 'item2', 'item3']);
      }
    });

    it('should handle nested objects', () => {
      const yamlContent = `
execution:
  environment_variables:
    AWS_PROFILE: dev
    NODE_ENV: test
hooks:
  before_destroy:
    - echo "Starting"
    - echo "Ready"
`;
      
      const result = parseYaml(yamlContent);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          execution: {
            environment_variables: {
              AWS_PROFILE: 'dev',
              NODE_ENV: 'test'
            }
          },
          hooks: {
            before_destroy: [
              'echo "Starting"',
              'echo "Ready"'
            ]
          }
        });
      }
    });
  });
});