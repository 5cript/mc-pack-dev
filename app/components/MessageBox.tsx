import React from 'react';

// Components
import StyledButton from './button';
import ReactModal from 'react-modal-resizable-draggable';
import TextareaAutosize from 'react-textarea-autosize';

// Styles
import styles from './MessageBox.css';

/**
 * Props:
 *  - visible: is visible?
 *  - message: what to display
 *  - onButtonPress: fired when a button is pressed
 *  - boxStyle: "YesNo", "Ok", "OkCancel"
 */
class MessageBox extends React.Component
{
    boxStyle : string;
    inputValue: string;

    state = {
        rodalVisible: false,
        rodalMessage: ''
    }

    constructor(props)
    {
        super(props)
    }

    onRodalClose()
    {
        this.setState({
            rodalVisible: false
        })
    }

    showRodal(message)
    {
        this.setState({
            rodalMessage: message,
            rodalVisible: true
        })
    }

    onButtonClick(whatButton)
    {
        this.props.onButtonPress(whatButton, this.inputValue);
    }

    updateInputValue = (val: string) =>
    {
        this.inputValue = val.target.value;
    }

    render()
    {
        if (this.props.boxStyle === undefined)
            this.boxStyle = "Ok";
        else
            this.boxStyle = this.props.boxStyle

        return (
            <ReactModal initWidth={this.props.width ? this.props.width : 650} initHeight={this.props.height ? this.props.height : 500} 
                onFocus={() => {}}
                className={styles.messageBoxModal}
                onRequestClose={()=>{this.onRodalClose()}} 
                isOpen={this.props.visible}
                disableResize={this.props.disableResize}
                disableMove={this.props.disableMove}
                top={100}
                left={200}
                disableVerticalMove={true}
                disableHorizontalMove={true}
            >
                <div className={styles.messageBoxHeader}>{this.props.title}</div>
                {this.props.children}
                <TextareaAutosize  
                    className={styles.messageBoxText}
                    value={this.props.message === undefined ? '' : this.props.message}
                    readOnly   
                    wrap='soft'
                    style={{
                        display: this.props.disableInput === true ? 'none' : undefined
                    }}
                >    
                </TextareaAutosize>
                <div>
                    {(()=>{
                        if (this.boxStyle === "Input") 
                        {
                            return <input onChange={this.updateInputValue} style={{width: '400px', marginLeft: '10px', marginBottom: '5px'}}></input>
                        }
                        return <div/>;
                    })()}
                </div>
                <div className={styles.messageBoxButtons}>
                    {(()=>{
                        if (this.boxStyle === "YesNo") 
                        {
                            return (
                                <div className={styles.buttonBox}>
                                    <StyledButton className={styles.dialogButton} onClick={()=>{this.onButtonClick("Yes")}}>{"Yes"}</StyledButton>
                                    <StyledButton className={styles.dialogButton} onClick={()=>{this.onButtonClick("No")}}>{"No"}</StyledButton>
                                </div>
                            )
                        }
                        else if (this.boxStyle === "Ok") 
                        {
                            return (
                                <div className={styles.buttonBox}>
                                    <StyledButton className={styles.dialogButton} onClick={()=>{this.onButtonClick("Ok")}}>{"Ok"}</StyledButton>
                                </div>
                            )
                        }
                        else if (this.boxStyle === "OkCancel" || this.boxStyle === "Input") 
                        {
                            return (
                                <div className={styles.buttonBox}>
                                    <StyledButton className={styles.dialogButton} onClick={()=>{this.onButtonClick("Ok")}}>{"Ok"}</StyledButton>
                                    <StyledButton className={styles.dialogButton} onClick={()=>{this.onButtonClick("Cancel")}}>{"Cancel"}</StyledButton>
                                </div>
                            )
                        }
                        else if (this.boxStyle === "Modal") 
                        {
                            return (
                                <div style={{display: 'none'}}>
                                </div>
                            )
                        }
                        else 
                            return <div>Invalid Message Box Type</div>
                    })()}
                </div>
            </ReactModal>
        );
    }
}

export default MessageBox;