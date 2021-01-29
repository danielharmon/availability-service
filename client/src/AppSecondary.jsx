
import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import Calendar from './Calendar.jsx';
import ReservationSummary from './ReservationSummary.jsx';
import $ from 'jquery';
import {createBrowserHistory} from 'history';
import urlHelpers from './urlHelpers.js';
import availabilityHelpers from './availabilityHelpers';
import StateIndicator from './StateIndicator.jsx';
import styled from 'styled-components';
//const history = createBrowserHistory();

const CalendarContainer = styled.div`
  width: 720px;
  height: 330px;
`;

const AppContainer = styled.div`
  width: 720px;
  height: 600px;
`;

class AppSecondary extends React.Component {
  constructor(props) {
    super(props);

    var today = new Date();
    var oneMonthFromToday = new Date(today);
    oneMonthFromToday.setDate(today.getDate() + 30);

    this.state = {
      dates: [],
      checkIn: 'notSelected',
      checkOut: 'notSelected',
      maxSelectableDate: 'notSelected', //the last available date after the selected check-in date
      showing: false, //is calendar showing
      currentlySelecting: 'checkIn', //is the next date clicked to be check-in or check-out?
      activeSelecting: false,
      checkoutOnlyShowing: false,
      selectedCheckoutOnlyDate: 'none',
      hoveredDate: 'none',
      showCheckAvailabilityButton: true,
      showReserveButton: false,
      priceOfStay: 0,
      numNights: 0,
      minNightlyRate: 'none',
      nameOfStay: 'Big Bear Lake', //fix me later!
      month1Date: today,
      month2Date: oneMonthFromToday
    };

    this.monthsMap = availabilityHelpers.monthsMap;
    this.daysMap = availabilityHelpers.daysMap;
    this.history = this.props.history;
  }

  getStateObjFromUrl(searchStr, hash, dates) {
    var newState = {};

    newState.dates = dates;

    //secondary calendar should always be showing
    newState.showing = true;
    newState.activeSelecting = true;

    //what dates do we have?
    var checkInDate = urlHelpers.getCheckInOrOutDateFromUrl(searchStr, 'checkIn');
    var checkOutDate = urlHelpers.getCheckInOrOutDateFromUrl(searchStr, 'checkOut');

    if (checkInDate === null) {
      //this means we don't have a check-in or check-out date (UI forces this)
      newState.checkIn = 'notSelected';
      newState.checkOut = 'notSelected';
      newState.maxSelectableDate = 'notSelected';
    } else {
      newState.checkIn = checkInDate.toString();
      this.updateDisplayedMonths(0, checkInDate.toString());
      if (checkOutDate === null) {
        //we have a check-in but not a check-out
        newState.checkOut = 'notSelected';
        newState.maxSelectableDate = availabilityHelpers.getMaxSelectableDate(checkInDate, dates);
        newState.currentlySelecting = 'checkOut';
        if (newState.showing) {
          newState.checkAvailability = false;
        }
      } else {
        //we have both check-in and check-out
        newState.checkOut = availabilityHelpers.getDateObjFromStr(checkOutDate.toString());
        newState.maxSelectableDate = availabilityHelpers.getDateObjFromStr(checkOutDate.toString());
        newState.currentlySelecting = 'checkIn';
        newState.showReserveButton = true;
        newState.showCheckAvailabilityButton = false;
        newState.showReserveButton = true;
        this.getTotalPrice(checkOutDate, checkInDate, dates);
      }
    }
    return newState;
  }

  componentDidMount() {
    var productId = window.location.pathname.split('/')[1];
    if (productId === null || productId === undefined || productId.length === 0) {
      productId = '109';
    }
    var windowLocationSearch = window.location.search;
    var windowLocationHash = window.location.hash;

    this.history.listen(() => {
      this.setState(this.getStateObjFromUrl(window.location.search, window.location.hash, this.state.dates));
    });

    var urlStateInfo;
    $.ajax({
      method: 'GET',
      url: `/${productId}/availableDates`,
      success: (dates) => {
        urlStateInfo = this.getStateObjFromUrl(windowLocationSearch, windowLocationHash, dates);
        $.ajax({
          method: 'GET',
          url: `/${productId}/minNightlyRate`,
          success: ({minNightlyRate}) => {
            urlStateInfo.minNightlyRate = minNightlyRate;
            this.setState(urlStateInfo);
          },
          error: (err) => {
            urlStateInfo.minNightlyRate = 100;
            this.setState(urlStateInfo);
          }
        });
      },
      error: (err) => {
      }

    });
  }

  onSelect(dates) {
    this.setState({ dates });
  }

  onClickCheckinShowCalendar() {
    window.location.hash = '#availability-calendar';
    this.setState({
      showing: true,
      currentlySelecting: 'checkIn',
      activeSelecting: true,
      showReserveButton: false
    });
  }
  onClickCheckoutShowCalendar() {
    window.location.hash = '#availability-calendar';
    this.setState({
      showing: true,
      currentlySelecting: 'checkOut',
      activeSelecting: true,
      showReserveButton: false
    });
  }

  dateClicked(e, dateIsCheckoutOnly) {
    if (this.state.currentlySelecting === 'checkIn' && dateIsCheckoutOnly === false) {
      //go through dates and find the maxSelectableDate
      var checkInDate = availabilityHelpers.getDateObjFromStr(e);

      this.setState({
        checkIn: checkInDate.toString(),
        currentlySelecting: 'checkOut',
        maxSelectableDate: availabilityHelpers.getMaxSelectableDate(checkInDate, this.state.dates)
      });
      this.history.push(urlHelpers.makeQueryString(window.location.search, {
        check_in: checkInDate.toString()}), {foo: 'check_in'});

    } else if (this.state.currentlySelecting === 'checkOut') {
      //if we selected check-out date, set check-out date and close the calendar
      var checkOutDate = availabilityHelpers.getDateObjFromStr(e);
      this.setState({
        checkOut: checkOutDate.toString(),
        showing: false,
        activeSelecting: false,
        showCheckAvailabilityButton: false,
        showReserveButton: true
      });
      this.history.push(urlHelpers.makeQueryString(window.location.search, {
        check_in: this.state.checkIn.toString(),
        check_out: checkOutDate.toString()}), {foo: 'check_out'});
      window.location.hash = '';
      this.getTotalPrice(checkOutDate.toString());
    } else if (dateIsCheckoutOnly) {
      var checkOutOnlyDate = availabilityHelpers.getDateObjFromStr(e);
      this.setState({
        checkoutOnlyShowing: true,
        selectedCheckoutOnlyDate: checkOutOnlyDate.toString()
      });
    }

  }

  clearDates() {
    this.setState({
      activeSelecting: true,
      currentlySelecting: 'checkIn',
      checkIn: 'notSelected',
      checkOut: 'notSelected',
      selectedCheckoutOnlyDate: 'none',
      hoveredDate: 'none',
      checkoutOnlyShowing: false,
      howCheckAvailabilityButton: true,
      showReserveButton: false,
      maxSelectableDate: 'notSelected'
    });
    this.history.push(urlHelpers.removeDatesFromQueryString(window.location.search), {foo: 'clear_dates'});

  }

  closeCalendar() {
    this.setState({
      activeSelecting: false,
      currentlySelecting: 'checkIn',
      showing: false
    });
    window.location.hash = '';
  }

  changeHoveredDate(date) {
    var hDate = availabilityHelpers.getDateObjFromStr(date);
    this.setState({
      hoveredDate: hDate.toString()
    });
  }

  getTotalPrice(checkOut, checkIn, dates) {
    var checkOutDate = new Date(checkOut);
    if (checkIn === undefined) {
      var checkInDate = availabilityHelpers.getDateObjFromStr(this.state.checkIn);
    } else {
      var checkInDate = availabilityHelpers.getDateObjFromStr(checkIn);
    }
    if (dates === undefined) {
      dates = this.state.dates;
    }

    var numNights = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    this.setState({ numNights });
    for (var i = 0; i < dates.length; i++) {
      var thisNight = dates[i];
      var thisNightDate = availabilityHelpers.getDateObjFromStr(dates[i].date);
      if (thisNightDate.toString() === checkInDate.toString()) {
        this.setState({
          priceOfStay: dates[i].nightlyRate * numNights,
          cleaningFee: thisNight.cleaningFee * numNights,
          serviceFee: thisNight.serviceFee * numNights
        });
        return;
      }
    }
  }

  getCheckIn() {
    return new Date(this.state.checkIn);
  }

  getCheckOut() {
    return new Date(this.state.checkOut);
  }

  goNextMonth() {
    this.setState({
      month1Date: new Date(this.state.month2Date),
      month2Date: new Date(this.state.month2Date.setDate(this.state.month2Date.getDate() + 31))
    });
  }

  goPrevMonth() {
    this.setState({
      month1Date: new Date(this.state.month1Date.setDate(this.state.month1Date.getDate() - 31)),
      month2Date: new Date(this.state.month2Date.setDate(this.state.month2Date.getDate() - 31)),
    });
  }

  updateDisplayedMonths(dir, checkIn) {
    if (dir === -1) {
      this.goPrevMonth();
    } else if (dir === 1) {
      this.goNextMonth();
    } else if (dir === 0) {
      var newMonth1 = new Date(checkIn);
      if(this.state.month2Date.getMonth() !== newMonth1.getMonth()) {
        newMonth1.setDate(1);
        var newMonth2 = new Date(newMonth1);
        newMonth2.setDate(newMonth2.getDate() + 31);
        console.log(newMonth1, newMonth2)
        this.setState({
          month1Date: newMonth1,
          month2Date: newMonth2
        })
      }
    }
  }

  render() {
    var checkInStyle = {
      fontWeight: 'normal'
    };
    var checkOutStyle = {
      fontWeight: 'normal'
    };
    if (this.state.activeSelecting === true && this.state.currentlySelecting === 'checkIn') {
      var checkInStyle = {
        fontWeight: 'bold'
      };
    }
    if (this.state.activeSelecting === true && this.state.currentlySelecting === 'checkOut') {
      var checkOutStyle = {
        fontWeight: 'bold'
      };
    }
    return (
      <AppContainer>
        <div id = 'stateIndicator'>
          <StateIndicator checkIn = {this.state.checkIn} checkOut = {this.state.checkOut} showReserveButton = {this.state.showReserveButton} numNights = {this.state.numNights} nameOfStay = {this.state.nameOfStay}/>
        </div>

        <CalendarContainer>
          <div id = 'calendar-table' data-testId = 'calendar' >
            <Calendar
              id={2}
              maxSelectableDate = {this.state.maxSelectableDate}
              hoveredDate = {this.state.hoveredDate}
              changeHoveredDate = {this.changeHoveredDate.bind(this)}
              selectedCheckoutOnlyDate = {this.state.selectedCheckoutOnlyDate}
              dates = {this.state.dates} checkInDate = {this.state.checkIn}
              checkOutDate = {this.state.checkOut}
              clearDates = {this.clearDates.bind(this)}
              closeCalendar = {this.closeCalendar.bind(this)}
              dateClicked = {this.dateClicked.bind(this)}
              month1Date = {this.state.month1Date}
              month2Date = {this.state.month2Date}
              updateDisplayedMonths = {this.updateDisplayedMonths.bind(this)}/>
          </div>

          <div id = 'dateIsCheckoutOnly' style={{display: (this.state.checkoutOnlyShowing && (this.state.hoveredDate.toString().slice(0, 17) === this.state.selectedCheckoutOnlyDate.toString().slice(0, 17))) ? 'block' : 'none'}}> This date is check-out only. </div>
        </CalendarContainer>


      </AppContainer>


    );
  }
}

export default AppSecondary;