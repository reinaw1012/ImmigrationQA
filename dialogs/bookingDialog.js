// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { InputHints, MessageFactory } = require('botbuilder');
const { ConfirmPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { CancelAndHelpDialog } = require('./cancelAndHelpDialog');
const { DateResolverDialog } = require('./dateResolverDialog');

const CONFIRM_PROMPT = 'confirmPrompt';
const DATE_RESOLVER_DIALOG = 'dateResolverDialog';
const TEXT_PROMPT = 'textPrompt';
const WATERFALL_DIALOG = 'waterfallDialog';

class BookingDialog extends CancelAndHelpDialog {
    constructor(id) {
        super(id || 'bookingDialog');

        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ConfirmPrompt(CONFIRM_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.visaTypeStep.bind(this),
                this.workTypeStep.bind(this),
                this.occupationStatusStep.bind(this)
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    /**
     * If a destination city has not been provided, prompt for one.
     */
    async destinationStep(stepContext) {
        const bookingDetails = stepContext.options;

        if (!bookingDetails.destination) {
            const messageText = 'To what city would you like to travel?';
            const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(bookingDetails.destination);
    }

    /**
     * If an origin city has not been provided, prompt for one.
     */

    async visaTypeStep(stepContext) {
        // console.log("visa status step");
        const userinfo = stepContext.options;
        // console.log(userinfo);
        if (!userinfo.visa_type) {
            // const messageText = 'What visa type do you current have?';
            // const msg = MessageFactory.text(messageText, 'What visa type do you current have?', InputHints.ExpectingInput);
            // return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
            userinfo.visa_type = 'f1';
        }
        return await stepContext.next(userinfo.visa_type);
    }

    async workTypeStep(stepContext) {
        // console.log("work status step");
        const userinfo = stepContext.options;
        // console.log(userinfo);
        userinfo.visa_type = stepContext.result;
        if (!userinfo.work_type) {
            // const messageText = 'What work authorization do you want to learn about?';
            // const msg = MessageFactory.text(messageText, 'What work authorization do you want to learn about?', InputHints.ExpectingInput);
            // return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
            userinfo.work_type = 'opt';
        }
        return await stepContext.next(userinfo.work_type);
    }

    async occupationStatusStep(stepContext) {
        // console.log("occupation status step");
        const userinfo = stepContext.options;
        // console.log(userinfo);
        userinfo.work_type = stepContext.result;
        if (!userinfo.occupation_status) {
            // const messageText = 'What job do you currently hold? If you do not currently have a job, just reply "student".';
            // const msg = MessageFactory.text(messageText, 'What job do you currently hold? If you do not currently have a job, just reply "student".', InputHints.ExpectingInput);
            // return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
            userinfo.occupation_status = 'student'
        }
        return await stepContext.next(userinfo);
    }

    async originStep(stepContext) {
        const bookingDetails = stepContext.options;

        // Capture the response to the previous step's prompt
        bookingDetails.destination = stepContext.result;
        if (!bookingDetails.origin) {
            const messageText = 'From what city will you be travelling?';
            const msg = MessageFactory.text(messageText, 'From what city will you be travelling?', InputHints.ExpectingInput);
            return await stepContext.prompt(TEXT_PROMPT, { prompt: msg });
        }
        return await stepContext.next(bookingDetails.origin);
    }

    /**
     * If a travel date has not been provided, prompt for one.
     * This will use the DATE_RESOLVER_DIALOG.
     */
    async travelDateStep(stepContext) {
        const bookingDetails = stepContext.options;

        // Capture the results of the previous step
        bookingDetails.origin = stepContext.result;
        if (!bookingDetails.travelDate || this.isAmbiguous(bookingDetails.travelDate)) {
            return await stepContext.beginDialog(DATE_RESOLVER_DIALOG, { date: bookingDetails.travelDate });
        }
        return await stepContext.next(bookingDetails.travelDate);
    }

    /**
     * Confirm the information the user has provided.
     */
    async confirmStep(stepContext) {
        const bookingDetails = stepContext.options;

        // Capture the results of the previous step
        bookingDetails.travelDate = stepContext.result;
        const messageText = `Please confirm, I have you traveling to: ${ bookingDetails.destination } from: ${ bookingDetails.origin } on: ${ bookingDetails.travelDate }. Is this correct?`;
        const msg = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);

        // Offer a YES/NO prompt.
        return await stepContext.prompt(CONFIRM_PROMPT, { prompt: msg });
    }

    /**
     * Complete the interaction and end the dialog.
     */
    async finalStep(stepContext) {
        if (stepContext.result === true) {
            const bookingDetails = stepContext.options;
            return await stepContext.endDialog(bookingDetails);
        }
        return await stepContext.endDialog();
    }

    isAmbiguous(timex) {
        const timexPropery = new TimexProperty(timex);
        return !timexPropery.types.has('definite');
    }
}

module.exports.BookingDialog = BookingDialog;
