import { createContext, useContext, useState, ReactNode } from 'react';
import { Group, Member, GroupCategory } from '../types';

interface GroupContextType {
  groups: Group[];
  addGroup: (group: Omit<Group, 'id' | 'createdAt'>) => void;
  updateGroup: (id: string, data: Partial<Group>) => void;
  deleteGroup: (id: string) => void;
  addMember: (member: Omit<Member, 'id'>) => void;
  removeMember: (memberId: string, groupId?: string) => void;
  getGroupMembers: (groupId: string) => Member[];
}

const SEED_GROUPS: Group[] = [
  {
    id: 'g1',
    name: 'Goa Trip 2024',
    description: 'Annual beach trip with friends',
    category: GroupCategory.Trip,
    simplifyDebts: true,
    members: [
      {
        id: 'm1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Alice',
        groupId: 'g1',
      },
      {
        id: 'm2',
        name: 'Bob Smith',
        email: 'bob@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Bob',
        groupId: 'g1',
      },
      {
        id: 'm3',
        name: 'Carol White',
        email: 'carol@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Carol',
        groupId: 'g1',
      },
    ],
    createdAt: '2024-12-01',
    createdBy: '1',
  },
  {
    id: 'g2',
    name: 'Apartment 4B',
    description: 'Shared apartment expenses',
    category: GroupCategory.Home,
    simplifyDebts: true,
    members: [
      {
        id: 'm4',
        name: 'David Lee',
        email: 'david@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=David',
        groupId: 'g2',
      },
      {
        id: 'm5',
        name: 'Eva Green',
        email: 'eva@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Eva',
        groupId: 'g2',
      },
    ],
    createdAt: '2024-11-15',
    createdBy: '1',
  },
  {
    id: 'g3',
    name: 'Kerala Trip',
    description: 'Couple trip',
    category: GroupCategory.Home,
    simplifyDebts: true,
    members: [
      {
        id: 'm6',
        name: 'siva',
        email: 'siva@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Siva',
        groupId: 'g3',
      },
      {
        id: 'm7',
        name: 'Anuja',
        email: 'anuja@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Anuja',
        groupId: 'g3',
      },
      {
        id: 'm8',
        name: 'Ojasvi',
        email: 'ojasvi@example.com',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Ojasvi',
        groupId: 'g3',
      },
    ],
    createdAt: '2025-05-27',
    createdBy: '1',
  },
];

const GroupContext = createContext<GroupContextType | null>(null);

export const GroupProvider = ({ children }: { children: ReactNode }) => {
  const [groups, setGroups] = useState<Group[]>(SEED_GROUPS);

  const addGroup = (group: Omit<Group, 'id' | 'createdAt'>) => {
    setGroups((prev) => [
      ...prev,
      {
        ...group,
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split('T')[0],
      },
    ]);
  };

  const updateGroup = (id: string, data: Partial<Group>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...data } : g)));
  };

  const deleteGroup = (id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const addMember = (member: Omit<Member, 'id'>) => {
    setGroups((prev) => {
      // Reuse the existing id if this person is already a member of another group
      const existingId = prev
        .flatMap((g) => g.members)
        .find((m) => m.email.toLowerCase() === member.email.toLowerCase())?.id;

      return prev.map((g) => {
        if (g.id !== member.groupId) return g;
        if (
          g.members.some(
            (m) => m.email.toLowerCase() === member.email.toLowerCase()
          )
        )
          return g;
        return {
          ...g,
          members: [
            ...g.members,
            { ...member, id: existingId ?? Date.now().toString() },
          ],
        };
      });
    });
  };

  const removeMember = (memberId: string) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        members: g.members.filter((m) => m.id !== memberId),
      }))
    );
  };

  const getGroupMembers = (groupId: string) =>
    groups.find((g) => g.id === groupId)?.members ?? [];

  return (
    <GroupContext.Provider
      value={{
        groups,
        addGroup,
        updateGroup,
        deleteGroup,
        addMember,
        removeMember,
        getGroupMembers,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
};

export const useGroups = () => {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroups must be used within GroupProvider');
  return ctx;
};
