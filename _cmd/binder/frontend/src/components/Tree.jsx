import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const TreeContainer = styled.div`
  user-select: none;
`;

const NodeWrapper = styled.div`
  margin-left: ${props => props.$isRoot ? '0' : '20px'};
  border-top: ${props => props.$isBefore ? '2px solid #1a73e8' : 'none'};
  border-bottom: ${props => props.$isAfter ? '2px solid #1a73e8' : 'none'};
`;

const NodeContentContainer = styled.div`
  background-color: ${props => props.$isInside ? 'rgb(41, 43, 48)' : 'transparent'};
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
`;

// アイコン列より少し左にはみ出す展開ボタン
const ExpandButton = styled.span`
  position: absolute;
  left: 1px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  cursor: pointer;
  text-align: center;
  font-family: monospace;
  font-size: 10px;
  line-height: 1;
  color: #aaa;
  z-index: 1;
`;

// padding-left でアイコン開始位置を固定し、ExpandButton の絶対配置先を提供
const NodeContent = styled.div`
  position: relative;
  padding: 2px 2px 2px 18px;
  border-radius: 2px;
  background-color: ${props => props.$isSelected ? '#222529' : 'transparent'};
  flex-grow: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  text-align: left;
`;

const IconWrapper = styled.span`
  margin-right: 5px;
  display: flex;
  align-items: center;
`;

// Helper functions to manipulate the tree data structure
const removeNode = (nodes, id) => {
  const nodeIndex = nodes.findIndex(n => n.id === id);
  if (nodeIndex > -1) return nodes.splice(nodeIndex, 1)[0];
  for (const node of nodes) {
    if (node.children) {
      const removedNode = removeNode(node.children, id);
      if (removedNode) return removedNode;
    }
  }
  return null;
};

const insertNode = (nodes, targetId, draggedNode, position) => {
    if (position === 'inside') {
        for (const node of nodes) {
            if (node.id === targetId) {
                if (!node.children) node.children = [];
                node.children.push(draggedNode);
                return { parentId: node.id, children: node.children };
            }
            if (node.children) {
                const result = insertNode(node.children, targetId, draggedNode, position);
                if (result) return result;
            }
        }
    } else {
        const targetIndex = nodes.findIndex(n => n.id === targetId);
        if (targetIndex > -1) {
            if (position === 'before') nodes.splice(targetIndex, 0, draggedNode);
            else nodes.splice(targetIndex + 1, 0, draggedNode);
            return { parentId: null, children: nodes };
        }
        for (const node of nodes) {
            if (node.children) {
                const result = insertNode(node.children, targetId, draggedNode, position);
                if (result) return { parentId: result.parentId !== null ? result.parentId : node.id, children: result.children };
            }
        }
    }
    return null;
};


const Tree = ({ data: initialData, onClick, onExpand, expand: expandedIds = [], onChange, selected, onSelect, icons = {}, onNodeContextMenu }) => {
  const [data, setData] = useState(initialData);
  const [selectedId, setSelectedId] = useState(selected);
  const [dropTargetInfo, setDropTargetInfo] = useState(null);
  const draggedNodeId = useRef(null);

  useEffect(() => { setData(initialData); }, [initialData]);
  useEffect(() => { setSelectedId(selected); }, [selected]);

  const handleDragStart = (e, id) => {
    draggedNodeId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  // ドラッグ終了時（ドロップ先なし・Escapeキーなど）に状態をリセット
  const handleDragEnd = () => {
    draggedNodeId.current = null;
    setDropTargetInfo(null);
  };

  // ドラッグ中の右クリックでキャンセルする（コンテナの空白エリア用）
  const handleContainerContextMenu = (e) => {
    if (draggedNodeId.current !== null) {
      e.preventDefault();
      draggedNodeId.current = null;
      setDropTargetInfo(null);
    }
  };

  const handleDragOver = (e, id, isRoot) => {
    e.preventDefault();
    if (id === draggedNodeId.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;
    let position;
    if (y < height / 3) position = 'before';
    else if (y > height * 2 / 3) position = 'after';
    else position = 'inside';
    if (isRoot && (position === 'before' || position === 'after')) {
        setDropTargetInfo(null);
        return;
    }
    setDropTargetInfo({ id, position });
  };

  const handleDragLeave = () => { setDropTargetInfo(null); };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedNodeId.current || !dropTargetInfo) return;
    const { id: targetId, position } = dropTargetInfo;
    if (draggedNodeId.current === targetId) return;

    const newData = JSON.parse(JSON.stringify(data));
    const draggedNode = removeNode(newData, draggedNodeId.current);
    if (!draggedNode) return;

    const insertResult = insertNode(newData, targetId, draggedNode, position);

    if (insertResult) {
      if (position === 'inside' && onExpand) {
        const currentExpandedIds = new Set(expandedIds);
        if (!currentExpandedIds.has(targetId)) {
          onExpand(targetId);
        }
      }
      setData(newData);
      if (onChange) {
        onChange({
          draggedId: draggedNode.id,
          parentId: insertResult.parentId,
          childIds: insertResult.children.map(c => c.id)
        });
      }
    }
    draggedNodeId.current = null;
    setDropTargetInfo(null);
  };

  const renderNode = (node, isRoot = false) => {
    const expandedIdSet = new Set(expandedIds);
    const isExpanded = expandedIdSet.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    const getIconForType = (node) => {
        const finalIcons = {
            file: '📄',
            folder: '📁',
            folderOpen: '📂',
            // Default icons, can be overridden by the `icons` prop
            js: '🌐',
            css: '🎨',
            json: '🗄️',
            md: '📜',
            // Add more default file type icons here
            ...icons,
        };

        if (node.type === 'folder') {
            return isExpanded ? finalIcons.folderOpen : finalIcons.folder;
        } else if (node.type) {
            // Priority: direct type match in icons > extension match > default file icon
            if (finalIcons[node.type]) {
                return finalIcons[node.type];
            }
            const parts = node.name.split('.');
            const extension = parts.length > 1 ? parts[parts.length - 1] : null;
            if (extension && finalIcons[extension]) {
                return finalIcons[extension];
            }
            return finalIcons.file || '📄';
        }
        return null; // No icon for unknown type
    };
    const icon = getIconForType(node);

    const handleNodeClick = () => {
      setSelectedId(node.id);
      if (onSelect) onSelect(node.id);
      if (onClick) onClick(node);
    };

    const isBefore = dropTargetInfo && dropTargetInfo.id === node.id && dropTargetInfo.position === 'before';
    const isAfter = dropTargetInfo && dropTargetInfo.id === node.id && dropTargetInfo.position === 'after';
    const isInside = dropTargetInfo?.id === node.id && dropTargetInfo?.position === 'inside';

    return (
      <NodeWrapper key={node.id} $isRoot={isRoot} $isBefore={isBefore} $isAfter={isAfter}>
        <NodeContentContainer
          draggable={!isRoot}
          onDragStart={(e) => !isRoot && handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id, isRoot)}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          onContextMenu={(e) => {
            if (draggedNodeId.current !== null) {
              // ドラッグ中の右クリック → ドラッグをキャンセル
              e.preventDefault();
              draggedNodeId.current = null;
              setDropTargetInfo(null);
              return;
            }
            onNodeContextMenu && onNodeContextMenu(e, node);
          }}
          $isInside={isInside}
        >
            <Row>
              <NodeContent
                onClick={handleNodeClick}
                onDoubleClick={(e) => { e.stopPropagation(); if (hasChildren) onExpand && onExpand(node.id); }}
                $isSelected={isSelected}
              >
                {hasChildren && (
                  <ExpandButton onClick={(e) => { e.stopPropagation(); onExpand && onExpand(node.id); }}>
                    {isExpanded ? '−' : '+'}
                  </ExpandButton>
                )}
                <IconWrapper>
                    {typeof icon === 'string' ? icon : React.isValidElement(icon) ? icon : icon ? React.createElement(icon) : null}
                </IconWrapper>
                <span>{node.name}</span>
              </NodeContent>
            </Row>
        </NodeContentContainer>
        {hasChildren && isExpanded && (
          <div>{node.children.map(child => renderNode(child, false))}</div>
        )}
      </NodeWrapper>
    );
  };

  return <TreeContainer onContextMenu={handleContainerContextMenu} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>{data.map(node => renderNode(node, true))}</TreeContainer>;
};

Tree.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    children: PropTypes.array,
  })).isRequired,
  onClick: PropTypes.func,
  onExpand: PropTypes.func,
  expand: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  onChange: PropTypes.func,
  selected: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func,
  icons: PropTypes.object,
  onNodeContextMenu: PropTypes.func,
};

// EmptySpacer は廃止（NodeContent の padding-left でアイコン位置を統一）

export default Tree;
