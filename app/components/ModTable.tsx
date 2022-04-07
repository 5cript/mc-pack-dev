import React from 'react';

// Components
import { useTable, useBlockLayout } from 'react-table';

import classNames from 'classnames';
import moment from 'moment';

import styles from './ModTable.css';

const TableCell = ({
    value: initialValue,
    row: { index },
    column: { id },
    updateMyData, // This is a custom function that we supplied to our table instance
    removeData,
    onInstallClick,
    onInstallSpecificClick
}) => {
    // We need to keep and update the state of the cell normally
    const [value, setValue] = React.useState(initialValue)

    const onChange = e => {
        setValue(e.target.value)
    }

    const onDelete = e => {
        removeData(index);
    }

    // We'll only update the external data when the input is blurred
    const onBlur = () => {
        updateMyData(index, id, value)
    }

    // If the initialValue is changed external, sync it up with our state
    React.useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    /*
    if (id !== 'deleter')
        return <input className={classNames('minimalInput', 'tableCell')} value={value} onChange={onChange} onBlur={onBlur} />
    else
        return <div className="tableRemoveButton" onClick={onDelete}>{"\u274C"}</div>
    */

    const getTimeClass = () => 
    {
        let timeClass = styles.uninstalledMod;
        if (value.manualInstall)
            timeClass = styles.manualInstalledMod;
        else if (value.installed === "" || value.newest === "?" || value.installed === "?")
            timeClass = styles.uninstalledMod;
        else if (moment(value.newest).isAfter(value.installed))
            timeClass = styles.outOfDateMod;
        else
            timeClass = styles.installedMod;

        return timeClass;
    }
   
    if (id === 'deleter')
        return <div>
            <div className={styles.removeButton} onClick={onDelete}>{"\u274C"}</div>
            <div className={styles.updateButton} onClick={() => onInstallClick(index)}>{"\u21D1"}</div>
        </div>
    else if (id === 'icon')
    {
        return <img src={value} alt="Red dot"/>
    }
    else if (id === 'name')
    {
        let className = undefined;
        if (value.error)
        {
            if (value.manualInstall !== undefined)
                className = styles.manualInstalledMod;
            else
                className = styles.uninstalledMod;
        }
        return <div className={classNames(className, styles.cell)}>{value.name}</div>
    }
    else if (id === 'installed_time')
    {   
        const timeClass = getTimeClass();

        if (value === undefined)
            return <div className={styles.cell}>?</div>
        return <div className={classNames(timeClass, styles.cell)} onClick={() => {onInstallClick(index)}} style={{cursor: "pointer"}}>
            {moment(value.installed).format("D. MMM YYYY - HH:mm:ss")}
        </div>
    }
    else if (id === 'newest_time')
    {
        if (value === undefined || value === "?")
            return <div className={styles.cell}>?</div>

        const timeClass = getTimeClass();

        let date = moment(value.newest).format("D. MMM YYYY - HH:mm:ss");
        if (value.manualInstall)
            date = moment(value.manualInstall.newestTimestamp).format("D. MMM YYYY - HH:mm:ss") + "? [MANUAL INSTALL]";

        return <div 
            className={classNames(timeClass, styles.cell)}>
            {date}
        </div>
    }
    else if (id === 'version')
    {
        if (value === undefined)
            return <div className={styles.cell}>?</div>
        return <div onClick={() => {onInstallSpecificClick(index)}} style={{cursor: "pointer", width:'100%'}}>
            {value}
        </div>
    }
    else
        return <div className={styles.cell}>{value}</div>
        
}

function Table({columns, data, updateMyData, removeData, addLine, onInstallClick, onInstallSpecificClick}) {
    const defaultColumn = React.useMemo(
        () => ({
            minWidth: 5,
            maxWidth: 4000,
            width: "100%",
            Cell: TableCell
        }),
        []
    )

    // Use the state and functions returned from useTable to build your UI
    const {
        getTableProps,
        getTableBodyProps,
        headerGroups,
        rows,
        prepareRow,
    } = useTable({
        columns,
        data,
        defaultColumn,
        updateMyData,
        removeData,
        addLine,
        onInstallClick,
        onInstallSpecificClick
    },
        useBlockLayout,
        hooks => {
            hooks.visibleColumns.push(columns => {
                return [
                    {
                        id: 'deleter',
                        groupByBoundary: true,
                        width: 25,
                        Header: () => (
                            <div className="tableAddButton" onClick={() => {addLine()}}>{''}</div>
                        ),
                    },
                    ...columns
                ]
            })
        }
    )

    // Render the UI for your table
    return (
        <div {...getTableProps()} className={styles.table}>
            <div>
                {headerGroups.map(headerGroup => (
                    <div {...headerGroup.getHeaderGroupProps()} className={styles.tableHead}>
                        {headerGroup.headers.map(column => (
                            <div {...column.getHeaderProps()} className={styles.tableHeadCell}>
                                {column.render('Header')}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div {...getTableBodyProps()}>
                {rows.map((row, i) => {
                    prepareRow(row)
                    let rowProps = row.getRowProps();
                    rowProps.style.width = "100%";
                    return (
                        <div {...rowProps} className={styles.tableRow}>
                            {row.cells.map((cell, i) => {
                                let cellProps = cell.getCellProps();
                                cellProps.style.minWidth = cellProps.style.width;
                                delete cellProps.style.width;
                                if (i === row.cells.length - 1)
                                {
                                    cellProps.style.width = '100%';
                                }
                                return (
                                    <div {...cellProps} className={styles.tableRowCell}>
                                        {cell.render('Cell')}
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

class ModTable extends React.Component
{
    state=
    {
        skipPageReset: false
    }

    constructor(props)
    {
        super(props);

        document.addEventListener('mousedown', this.defocus);
    }

    defocus = (event) =>
    {
        if (event === undefined || (this.inputRef && !this.inputRef.contains(event.target)))
            this.setState({editingIndex: -1});
    }

    setInputRef = (node) => 
    {
        this.inputRef = node;
    }

    updateData = (rowIndex, columnId, value) =>
    {
        this.props.onChange(rowIndex, columnId, value);
    }

    removeData = (rowIndex) =>
    {
        this.props.onDelete(rowIndex);
    }

    addLine = () => 
    {
        this.props.addLine();
    }

    render()
    {
        return (
            <Table 
                columns={this.props.columns} 
                data={this.props.data} 
                updateMyData={(...args) => {this.updateData(...args)}} 
                removeData={(...args) => {this.removeData(...args)}}
                addLine={this.addLine}
                onInstallClick={(...args) => {this.props.onInstallClick(...args)}}
                onInstallSpecificClick={(...args) => {this.props.onInstallSpecificClick(...args)}}
            />
        );
    }
}

export default ModTable;