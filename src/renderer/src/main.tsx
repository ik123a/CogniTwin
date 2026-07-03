import './assets/main.css'

if (!(window as any).api) {
  console.log('[CogniTwin] Running in Web/Mobile mode. Activating RPC API Bridge...');

  const streamCallbacks = new Map<string, Function>();

  const executeRpc = async (channel: string, args: any) => {
    if (channel === 'llm:chat-stream') {
      try {
        const response = await fetch('http://localhost:3000/api/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, args })
        });

        if (!response.body) return '';

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let responseText = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (data.event === 'llm:token') {
                    const onTokenCallback = streamCallbacks.get('llm:token');
                    if (onTokenCallback) {
                      onTokenCallback({ sessionId: args.sessionId, token: data.token });
                    }
                    responseText += data.token;
                  }
                } catch (e) {}
              }
            }
          }
        }
        return responseText;
      } catch (err) {
        console.error('LLM Chat Stream request failed:', err);
        throw err;
      }
    }

    const res = await fetch('http://localhost:3000/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, args })
    });
    
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'RPC request failed');
    return json.data;
  };

  const createProxy = (path: string[] = []): any => {
    return new Proxy(() => {}, {
      get(_target, prop: string) {
        return createProxy([...path, prop]);
      },
      apply(_target, _thisArg, argsList) {
        const channel = path.join(':');
        
        if (channel === 'llm:onToken') {
          streamCallbacks.set('llm:token', argsList[0]);
          return () => streamCallbacks.delete('llm:token');
        }
        if (channel === 'intelligence:onIndexProgress') {
          streamCallbacks.set('intelligence:index-progress', argsList[0]);
          return () => streamCallbacks.delete('intelligence:index-progress');
        }
        if (channel === 'shortcuts:onTrigger') {
          return () => {};
        }

        if (channel === 'auth:register') {
          return executeRpc(channel, { name: argsList[0], password: argsList[1] });
        }
        if (channel === 'auth:login') {
          return executeRpc(channel, { password: argsList[0] });
        }
        if (channel === 'db:query' || channel === 'db:get' || channel === 'db:execute') {
          return executeRpc(channel, { sql: argsList[0], params: argsList[1] || [] });
        }
        if (channel === 'llm:chatStream' || channel === 'llm:sendMessage') {
          return executeRpc('llm:chat-stream', { sessionId: argsList[0], prompt: argsList[1] });
        }
        if (channel === 'window:minimize' || channel === 'window:maximize' || channel === 'window:close') {
          return Promise.resolve();
        }

        const payload: any = {};
        if (argsList.length > 0) {
          if (typeof argsList[0] === 'object' && argsList[0] !== null) {
            Object.assign(payload, argsList[0]);
          } else {
            if (channel === 'backup:create' || channel === 'backup:createEncrypted' || channel === 'backup:createIncremental') {
              payload.destinationPath = argsList[0];
              if (argsList[1]) payload.password = argsList[1];
            } else if (channel === 'backup:restore' || channel === 'backup:restoreEncrypted') {
              payload.backupFilePath = argsList[0];
              if (argsList[1]) payload.password = argsList[1];
            } else if (channel === 'watch:start') {
              payload.folderPath = argsList[0];
              payload.workspaceId = argsList[1];
              payload.projectId = argsList[2];
            } else if (channel === 'watch:stop') {
              payload.folderPath = argsList[0];
            } else if (channel === 'spaced:review') {
              payload.cardId = argsList[0];
              payload.grade = argsList[1];
            } else if (channel === 'spaced:create') {
              payload.noteId = argsList[0];
              payload.front = argsList[1];
              payload.back = argsList[2];
            } else if (channel === 'learning:createGoal') {
              return executeRpc('learning:create-goal', { title: argsList[0], topic: argsList[1] });
            } else if (channel === 'learning:getSteps') {
              return executeRpc('learning:get-steps', { goalId: argsList[0] });
            } else if (channel === 'learning:completeStep') {
              return executeRpc('learning:complete-step', { stepId: argsList[0] });
            } else if (channel === 'learning:performGap') {
              return executeRpc('learning:perform-gap', { goalId: argsList[0] });
            } else if (channel === 'versioning:snapshot') {
              return executeRpc('versioning:snapshot', { noteId: argsList[0] });
            } else if (channel === 'versioning:history') {
              return executeRpc('versioning:history', { noteId: argsList[0] });
            } else if (channel === 'versioning:diff') {
              return executeRpc('versioning:diff', { versionId: argsList[0] });
            } else if (channel === 'versioning:rollback') {
              return executeRpc('versioning:rollback', { noteId: argsList[0], versionId: argsList[1] });
            } else if (channel === 'versioning:snapshotItem') {
              return executeRpc('versioning:snapshot-item', { entityType: argsList[0], entityId: argsList[1], snapshotData: argsList[2] });
            } else if (channel === 'versioning:itemHistory') {
              return executeRpc('versioning:item-history', { entityType: argsList[0], entityId: argsList[1] });
            } else if (channel === 'versioning:rollbackItem') {
              return executeRpc('versioning:rollback-item', { entityType: argsList[0], entityId: argsList[1], versionId: argsList[2] });
            }
          }
        }
        
        const kebabChannel = channel
          .replace('createEncrypted', 'create-encrypted')
          .replace('restoreEncrypted', 'restore-encrypted')
          .replace('createIncremental', 'create-incremental')
          .replace('searchUnified', 'search-unified')
          .replace('getClusters', 'get-clusters')
          .replace('runClustering', 'run-clustering')
          .replace('autoOrganize', 'auto-organize')
          .replace('extractTasks', 'extract-tasks')
          .replace('getActive', 'get-active')
          .replace('getGoals', 'get-goals')
          .replace('createGoal', 'create-goal')
          .replace('getSteps', 'get-steps')
          .replace('completeStep', 'complete-step')
          .replace('performGap', 'perform-gap')
          .replace('getTimeline', 'get-timeline')
          .replace('getState', 'get-state')
          .replace('createCategory', 'create-category')
          .replace('getRecoverable', 'get-recoverable')
          .replace('getAll', 'get-all')
          .replace('runJs', 'run-js')
          .replace('runPython', 'run-python')
          .replace('markovForecast', 'markov-forecast')
          .replace('monteCarlo', 'monte-carlo')
          .replace('decisionSave', 'decision-save')
          .replace('decisionList', 'decision-list')
          .replace('decisionDelete', 'decision-delete')
          .replace('secureDelete', 'secure-delete')
          .replace('getRules', 'get-rules')
          .replace('createRule', 'create-rule')
          .replace('deleteRule', 'delete-rule')
          .replace('getWorkflows', 'get-workflows')
          .replace('saveWorkflow', 'save-workflow')
          .replace('deleteWorkflow', 'delete-workflow')
          .replace('getMacros', 'get-macros')
          .replace('startRecording', 'start-recording')
          .replace('stopRecording', 'stop-recording')
          .replace('playMacro', 'play-macro')
          .replace('getScheduledActions', 'get-scheduled-actions')
          .replace('saveScheduledAction', 'save-scheduled-action')
          .replace('deleteScheduledAction', 'delete-scheduled-action')
          .replace('getStats', 'get-stats')
          .replace('getAccounts', 'get-accounts')
          .replace('saveAccount', 'save-account')
          .replace('deleteAccount', 'delete-account')
          .replace('syncAll', 'sync-all')
          .replace('getEnergyBlocks', 'get-energy-blocks')
          .replace('dataExport:toJSON', 'export:json')
          .replace('dataExport:toCSV', 'export:csv')
          .replace('dataExport:toMarkdown', 'export:markdown')
          .replace('dataExport:history', 'export:history')
          .replace('dataImport:detect', 'import:detect')
          .replace('dataImport:preview', 'import:preview')
          .replace('dataImport:fromJSON', 'import:json')
          .replace('dataImport:fromCSV', 'import:csv')
          .replace('dataImport:fromMarkdown', 'import:markdown')
          .replace('dataImport:history', 'import:history')
          .replace('dedup:scan', 'dedup:scan')
          .replace('dedup:groups', 'dedup:groups')
          .replace('dedup:merge', 'dedup:merge')
          .replace('dedup:dismiss', 'dedup:dismiss')
          .replace('expertise:detect', 'expertise:detect')
          .replace('expertise:getProfile', 'expertise:get-profile')
          .replace('expertise:scoreNote', 'expertise:score-note')
          .replace('expertise:getQuality', 'expertise:get-quality')
          .replace('expertise:discoverLinks', 'expertise:discover-links')
          .replace('expertise:getLinks', 'expertise:get-links')
          .replace(':', ':')
          .replace(':', ':');

        const finalKebabChannel = kebabChannel.replace('dataExport', 'export').replace('dataImport', 'import');

        return executeRpc(finalKebabChannel, payload);
      }
    });
  };

  (window as any).api = createProxy();
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
