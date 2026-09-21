import json
import re

with open('/home/brk/.gemini/antigravity/brain/57cd5779-179a-4ffe-b78d-e4ad5ed45b92/.system_generated/logs/transcript_full.jsonl', 'r', encoding='utf-8', errors='ignore') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try:
            data = json.loads(line)
        except:
            continue
            
        if data.get('type') == 'TOOL_RESPONSE' and 'output' in data:
            if 'app/page.tsx' in data['output'] and 'Total Lines:' in data['output']:
                with open('page.tsx.bak', 'w') as out:
                    out.write(data['output'])
            if 'hooks/useLogFile.ts' in data['output'] and 'Total Lines:' in data['output']:
                with open('useLogFile.ts.bak', 'w') as out:
                    out.write(data['output'])

for file in ['page.tsx.bak', 'useLogFile.ts.bak']:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        content = []
        parsing = False
        for line in lines:
            if 'The following code has been modified' in line:
                parsing = True
                continue
            if 'The above content shows the entire, complete file' in line or 'The above content does NOT show the entire' in line:
                parsing = False
                continue
            if parsing:
                match = re.match(r'^\d+:\s(.*)$', line)
                if match:
                    content.append(match.group(1) + '\n')
                elif re.match(r'^\d+:$', line.strip()):
                    content.append('\n')
        
        with open(file.replace('.bak', ''), 'w', encoding='utf-8') as out:
            out.writelines(content)
    except FileNotFoundError:
        pass
