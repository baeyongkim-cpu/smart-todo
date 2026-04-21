import localforage from 'localforage';

localforage.config({
  name: 'FocusFlow',
  storeName: 'tasks'
});

export const saveTasks = async (tasks) => {
  return await localforage.setItem('tasks', tasks);
};

export const loadTasks = async () => {
  const tasks = await localforage.getItem('tasks');
  return tasks || [];
};
